import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'
import { useDMs } from './hooks/useDMs'
import { useFollow } from './hooks/useFollow'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import { useDMFolders, MAX_SECONDARY_FOLDERS } from './hooks/useDMFolders'
import { usePinnedChannels } from '../../../hooks/usePinnedChannels'
import { useResizablePanel } from '../../../hooks/useResizablePanel'
import DMView from './DMView'
import ProfileView from './ProfileView'
import ReportUserModal from './ReportUserModal'
import BlockUserModal from './BlockUserModal'
import Username from '../../../components/ui/Username'
import { formatMsgPreview } from '../../../lib/formatMsgPreview'
import { sanitizeSearchTerm } from '../../../lib/searchSanitize'
import '../dashboard.css'

function miniTimeAgo(ts, t) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return t('notifications.now')
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
}

export default function Social({ user, initialDMUserId, onNavigateToChannel, onActiveUnreadChange, onRefreshUnread }) {
  const { t } = useTranslation()
  const { conversations, loading, unreadCount, startConversation, acceptConversation, sendMessage, fetchMessages, markDmRead, blockUser } = useDMs(user.id)
  const { isFollowing, isFollower, follow, unfollow, isMutual } = useFollow(user.id)
  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const dmFolders = useDMFolders(user.id)
  const { pin: pinDM, unpin: unpinDM, isPinned: isDMPinned } = usePinnedChannels('fyb_pinned_dms')
  // Comparteix la mateixa amplada que la secció Canales perquè les dues columnes
  // dretes tinguin sempre la mateixa mida (abans DMs guardava un valor propi més petit).
  const { pct: miniPct, containerRef: splitRef, onResizerMouseDown } = useResizablePanel('fyb_panel_width_channels')
  const [openMuteMenu, setOpenMuteMenu] = useState(null)
  const [miniMenuId, setMiniMenuId] = useState(null)
  const [miniMuteId, setMiniMuteId] = useState(null)
  const [reportTarget, setReportTarget] = useState(null) // { id, username }
  const [blockTarget, setBlockTarget] = useState(null) // { id, username, convId }
  // S'incrementa en bloquejar la conversa oberta per forçar-ne el remount (mode lectura).
  const [blockBump, setBlockBump] = useState(0)

  // ── Carpetes de xats ──────────────────────────────────────────────────────
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const [folderDotsId, setFolderDotsId] = useState(null) // ⋮ obert per a quina carpeta
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderError, setFolderError] = useState('')
  const [folderPickFor, setFolderPickFor] = useState(null) // convId que s'acaba d'acceptar
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null) // { id, name }
  const [deleteFolderInput, setDeleteFolderInput] = useState('')
  const [miniMoveId, setMiniMoveId] = useState(null) // conv amb submenú "Mover a carpeta" obert
  const FOLDER_MUTE_MS = 100 * 365 * 24 * 3600 * 1000 // silenci "permanent" per carpeta

  // Assigna una conversa a una carpeta; si la carpeta està silenciada, silencia la conversa.
  const assignToFolder = (convId, folderId) => {
    dmFolders.assignConversation(convId, folderId)
    if (dmFolders.isFolderMuted(folderId)) mute(`dm_${convId}`, FOLDER_MUTE_MS)
  }

  // Silenciar/activar una carpeta = silencia/activa TOTS els seus xats.
  const toggleFolderMute = (folderId) => {
    const nowMuted = dmFolders.toggleFolderMuted(folderId)
    conversations.filter(c => dmFolders.folderOf(c.id) === folderId).forEach(c => {
      if (nowMuted) mute(`dm_${c.id}`, FOLDER_MUTE_MS); else unmute(`dm_${c.id}`)
    })
  }

  // Confirmació d'eliminar carpeta (has escrit la paraula de confirmació): esborra la carpeta i tots els xats de dins.
  const confirmDeleteFolder = () => {
    if (!deleteFolderTarget) return
    const { convIds, error } = dmFolders.deleteFolder(deleteFolderTarget.id)
    if (error) { alert(error); return }
    convIds.forEach(cid => blockUser(cid))
    if (activeConv && convIds.includes(activeConv.id)) { setView('list'); setActiveConv(null) }
    setDeleteFolderTarget(null)
    setDeleteFolderInput('')
  }

  const handleCreateFolder = () => {
    const { error } = dmFolders.createFolder(newFolderName)
    if (error) { setFolderError(error); return }
    setNewFolderName(''); setFolderError(''); setShowCreateFolder(false)
  }

  const [showSolicitudes, setShowSolicitudes] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'dm' | 'profile' | 'search'
  const [activeConv, setActiveConv] = useState(null)
  const [activeProfile, setActiveProfile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (initialDMUserId) handleStartDM(initialDMUserId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const term = sanitizeSearchTerm(q)
    // Si la cerca queda buida després de netejar (p.ex. només signes de puntuació),
    // no llancem `ilike.%%` (que faria match amb TOTS els perfils).
    if (!term) { setSearchResults([]); setSearching(false); return }
    const [{ data }, { data: myBlocks }, { data: blockedByOthers }] = await Promise.all([
      supabase.from('profiles').select('id, username, name, is_verified').or(`username.ilike.%${term}%,name.ilike.%${term}%`).neq('id', user.id).limit(20),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
    ])
    const hidden = new Set([
      ...(myBlocks || []).map(b => b.blocked_id),
      ...(blockedByOthers || []).map(b => b.blocker_id),
    ])
    // fyourbet (admin) SÍ apareix a la cerca de DMs: es comporta com un tipster normal.
    // La seva privacitat de MEMBRE (a quins canals s'ha unit) es manté a part. Només
    // s'exclouen els usuaris bloquejats.
    setSearchResults((data || []).filter(u => !hidden.has(u.id)).slice(0, 10))
    setSearching(false)
  }

  const handleStartDM = async (userId) => {
    // Auto-accept per al destinatari si ell ens segueix — la nostra conversa no apareixerà
    // com a solicitud per a ell perquè ja hi ha una relació prèvia en el seu sentit.
    const conv = await startConversation(userId, isFollower(userId))
    if (conv) {
      // startConversation retorna l'objecte cru de la DB sense el camp enriquit clearedAt.
      // El calculem aquí perquè DMView l'usa per filtrar els missatges anteriors a l'esborrat.
      // Sense això, el buscador / perfils / accés extern recuperen tots els missatges esborrats.
      const isUser1 = conv.user1_id === user.id
      const clearedAt = (isUser1 ? conv.user1_cleared_at : conv.user2_cleared_at) || null
      setActiveConv({ ...conv, clearedAt })
      setView('dm')
    }
  }

  const handleOpenProfile = (userId) => {
    setActiveProfile(userId)
    setView('profile')
  }

  const handleOpenConv = (conv) => {
    setActiveConv(conv)
    setView('dm')
  }

  // Xats buits (has obert el chat però no s'ha enviat res) NO surten a la llista:
  // és com si no hagués passat res. La conversa oberta segueix visible al panell.
  const hasMsgs = (c) => !!c.lastMessage
  // Conversa va a General (active) si:
  //   - acceptada explícitament, O
  //   - el segueixo (bypass solicitud), O
  //   - jo vaig iniciar (user1) SENSE haver esborrat mai (espero la primera resposta)
  // Qualsevol altra cosa amb missatge va a Solicituds (pending).
  const active = conversations.filter(c => {
    if (!hasMsgs(c)) return false
    if (c.isAccepted) return true
    if (isFollowing(c.otherId)) return true
    // Cas especial: jo he iniciat, l'altre no ha acceptat, i no he esborrat mai → General (espera)
    if (c.user1_id === user.id && !c.clearedAt) return true
    return false
  })
  const pending = conversations.filter(c => hasMsgs(c) && !active.some(a => a.id === c.id))
  const sortedConvs = [...active].sort((a, b) => {
    const aPin = isDMPinned(a.id), bPin = isDMPinned(b.id)
    if (aPin && !bPin) return -1
    if (!aPin && bPin) return 1
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  })
  // Converses visibles segons la carpeta activa (les solicituds no es filtren per carpeta).
  const visibleConvs = sortedConvs.filter(c => dmFolders.folderOf(c.id) === dmFolders.activeFolder)
  const activeFolderObj = dmFolders.folders.find(f => f.id === dmFolders.activeFolder) || dmFolders.folders[0]
  const miniMenuBtnStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)', gap: '6px' }

  const confirmWord = t('social.deleteFolderConfirmWord')

  // Ítem de conversa: MATEIX format per a solicituds (pendents) i converses actives,
  // amb el menú de 3 punts complet. Les solicituds només afegeixen la barra Aceptar/Bloquear
  // dins del xat (a DMView), però a la llista es veuen exactament igual que la resta.
  const renderConvItem = (c) => {
    const dmKey = `dm_${c.id}`
    const cmuted = isMuted(dmKey)
    const cpinned = isDMPinned(c.id)
    const isActive = c.id === activeConv?.id
    const menuOpen = miniMenuId === c.id
    const muteOpen = miniMuteId === c.id
    const moveOpen = miniMoveId === c.id
    const preview = formatMsgPreview(c.lastMessage) || ''
    const timeStr = miniTimeAgo(c.lastMessageAt, t)
    return (
      <div key={c.id} className={`canales-mini-item${isActive ? ' active' : ''}`}>
        <div onClick={() => handleOpenConv(c)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div className="canales-mini-avatar" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            {c.otherAvatarUrl
              ? <img src={c.otherAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : (c.otherUsername || '?')[0].toUpperCase()}
            {c.unread > 0 && !cmuted && (
              <div style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '16px', height: '16px', background: 'var(--color-error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', border: '2px solid var(--color-bg)', padding: '0 2px', boxSizing: 'border-box' }}>
                {c.unread > 9 ? '9+' : c.unread}
              </div>
            )}
          </div>
          <div className="canales-mini-body">
            <div className="canales-mini-row">
              <span className="canales-mini-name">
                {cpinned && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '3px' }}><AppIcon name="pin" size={10} /></span>}
                {c.otherUsername}
              </span>
              <span className="canales-mini-time">{timeStr}</span>
            </div>
            <div className="canales-mini-preview">
              {cmuted && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}><AppIcon name="bellOff" size={12} /></span>}
              {c.lastMessageIsOwn && !preview ? null : c.lastMessageIsOwn ? `${t('social.dmYouPrefix')}: ${preview}` : preview || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('social.noMessages')}</span>}
            </div>
          </div>
        </div>

        {/* ⋮ botó + dropdown */}
        <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center' }}>
          <button className="canales-mini-dots"
            onClick={e => { e.stopPropagation(); setMiniMenuId(menuOpen ? null : c.id); setMiniMuteId(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', padding: '2px 5px', borderRadius: 'var(--radius-sm)', fontWeight: 700, lineHeight: 1, opacity: menuOpen ? 1 : undefined }}>
            ⋮
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div onClick={() => setMiniMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  style={{ position: 'absolute', top: '26px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '175px', overflow: 'hidden' }}>
                  <button onClick={() => { cpinned ? unpinDM(c.id) : pinDM(c.id); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                    {cpinned ? <><AppIcon name="pin" size={13} /> {t('social.unpin')}</> : <><AppIcon name="pin" size={13} /> {t('social.pin')}</>}
                  </button>
                  <button onClick={() => {
                    if (cmuted) { unmute(dmKey); setMiniMenuId(null) }
                    else { setMiniMuteId(c.id); setMiniMenuId(null) }
                  }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                    {cmuted ? <><AppIcon name="bell" size={13} /> {t('social.unmuteNotifs')}</> : <><AppIcon name="bellOff" size={13} /> {t('social.muteNotifs')}</>}
                  </button>
                  <button onClick={() => { setMiniMoveId(c.id); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                    <AppIcon name="folder" size={13} /> {t('social.moveToFolder')}
                  </button>
                  <button onClick={() => {
                    if (window.confirm(t('social.deleteConvConfirm', { username: c.otherUsername }))) {
                      blockUser(c.id)
                      if (activeConv?.id === c.id) { setView('list'); setActiveConv(null) }
                    }
                    setMiniMenuId(null)
                  }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-error)' }}>
                    <AppIcon name="delete" size={13} /> {t('social.deleteChat')}
                  </button>
                  <button onClick={() => { setBlockTarget({ id: c.otherId, username: c.otherUsername, convId: c.id }); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-error)' }}>
                    <AppIcon name="ban" size={13} /> {t('social.block')}
                  </button>
                  <button onClick={() => { setReportTarget({ id: c.otherId, username: c.otherUsername }); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, color: 'var(--color-warning, #f59e0b)' }}>
                    <AppIcon name="flag" size={13} /> {t('social.report')}
                  </button>
                </motion.div>
              </>
            )}
            {muteOpen && (
              <>
                <div onClick={() => setMiniMuteId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  style={{ position: 'absolute', top: '26px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '155px', overflow: 'hidden' }}>
                  {MUTE_DURATIONS.map((d, i) => (
                    <button key={i} onClick={() => { mute(dmKey, d.ms); setMiniMuteId(null) }}
                      style={{ ...miniMenuBtnStyle, borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
                      {d.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
            {moveOpen && (
              <>
                <div onClick={() => setMiniMoveId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  style={{ position: 'absolute', top: '26px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '165px', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '0.5px solid var(--color-border)' }}>{t('social.moveTo')}</div>
                  {dmFolders.folders.map((f, i) => {
                    const here = dmFolders.folderOf(c.id) === f.id
                    return (
                      <button key={f.id} onClick={() => { assignToFolder(c.id, f.id); setMiniMoveId(null) }}
                        style={{ ...miniMenuBtnStyle, borderBottom: i < dmFolders.folders.length - 1 ? '0.5px solid var(--color-border)' : 'none', color: here ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: here ? 700 : 400 }}>
                        {here ? <><AppIcon name="check" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /></> : <><AppIcon name="folder" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /></>}{f.name}
                      </button>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="canales-split" ref={splitRef}>

      {/* 75% — contingut: DM actiu / perfil / resultats cerca / placeholder */}
      <div className="canales-chat-panel">
        {activeConv ? (
          <DMView
            key={`${activeConv.id}-${blockBump}`}
            conversation={activeConv}
            isFollowingOther={isFollowing(activeConv.otherId || activeConv.user2_id)}
            currentUser={user}
            onBack={() => { setView('list'); setActiveConv(null); onRefreshUnread?.() }}
            onSend={sendMessage}
            onFetchMessages={fetchMessages}
            onMarkRead={markDmRead}
            onUnreadChange={onActiveUnreadChange}
            // Menú de la capçalera del xat — mateixes accions que els 3 punts de la llista.
            isPinned={isDMPinned(activeConv.id)}
            onTogglePin={() => isDMPinned(activeConv.id) ? unpinDM(activeConv.id) : pinDM(activeConv.id)}
            isMutedConv={isMuted(`dm_${activeConv.id}`)}
            onMuteConv={(ms) => mute(`dm_${activeConv.id}`, ms)}
            onUnmuteConv={() => unmute(`dm_${activeConv.id}`)}
            onDeleteConv={() => {
              if (window.confirm(t('social.deleteConvConfirm', { username: activeConv.otherUsername }))) {
                blockUser(activeConv.id)
                setActiveConv(null); setActiveProfile(null); setView('list')
              }
            }}
            onBlock={() => setBlockTarget({ id: activeConv.otherId, username: activeConv.otherUsername, convId: activeConv.id })}
            onReport={() => setReportTarget({ id: activeConv.otherId, username: activeConv.otherUsername })}
            onViewProfile={(userId) => { setActiveConv(null); setActiveProfile(userId); setView('profile') }}
            onAccept={async (id) => {
              await acceptConversation(id)
              setActiveConv(prev => prev ? { ...prev, isAccepted: true } : prev)
              // Acceptar una solicitud sempre mou a General (sense modal de carpeta).
              assignToFolder(id, 'general')
              if (showSolicitudes) setShowSolicitudes(false)
            }}
            onNavigateToChannel={onNavigateToChannel}
            compact
          />
        ) : activeProfile ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <ProfileView
              userId={activeProfile}
              currentUser={user}
              onBack={() => { setView('list'); setActiveProfile(null) }}
              onStartDM={handleStartDM}
              isFollowing={isFollowing(activeProfile)}
              isFollower={isFollower(activeProfile)}
              onFollow={(userId) => follow(userId, user?.name || 'alguien')}
              onUnfollow={unfollow}
              onBlock={(userId) => { alert(t('social.userBlocked')) }}
              onReport={() => {}}
              onViewUser={handleOpenProfile}
            />
          </div>
        ) : (
          // Cercador centrat + resultats — no hi ha DM ni perfil obert
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflowY: 'auto', padding: '0 40px', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '380px', paddingTop: '18%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ opacity: 0.2 }}><AppIcon name="message" size={52} /></div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)', opacity: 0.7, textAlign: 'center' }}>
                  {active.length + pending.length > 0 ? t('social.selectConversation') : t('social.startSearching')}
                </div>
              </div>
              <input
                type="text"
                placeholder={t('social.searchPlaceholder')}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                maxLength={50}
                style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 16px', borderRadius: 'var(--radius-lg)', outline: 'none', boxSizing: 'border-box' }}
              />
              {searchQuery && (
                <div style={{ marginTop: '10px' }}>
                  {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>{t('social.searching')}</div>}
                  {!searching && searchResults.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>{t('social.noUsersFound')}</div>
                  )}
                  {searchResults.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: '8px' }}>
                      <div onClick={() => { handleOpenProfile(u.id); setSearchQuery(''); setSearchResults([]) }}
                        style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, cursor: 'pointer' }}>
                        {(u.username || u.name || '?')[0].toUpperCase()}
                      </div>
                      <div onClick={() => { handleOpenProfile(u.id); setSearchQuery(''); setSearchResults([]) }} style={{ flex: 1, cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                          <Username username={u.username} isVerified={u.is_verified} size="sm" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => isFollowing(u.id) ? unfollow(u.id) : follow(u.id, user?.name || 'alguien')}
                          style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: isFollowing(u.id) ? '0.5px solid var(--color-border)' : 'none', background: isFollowing(u.id) ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: isFollowing(u.id) ? 'var(--color-text-muted)' : '#010906', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                          {isMutual(u.id) ? <><AppIcon name="users" size={12} /> {t('social.friends')}</> : isFollowing(u.id) ? t('social.following') : t('social.follow')}
                        </button>
                        <button onClick={() => handleStartDM(u.id)}
                          style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                          <AppIcon name="message" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resizer arrossegable */}
      <div className="canales-resizer" onMouseDown={onResizerMouseDown} />

      {/* Mini-llista converses — dreta */}
      <div className="canales-mini-list" style={{ width: `${miniPct}%` }}>

        {/* VISTA SOLICITUDS */}
        {showSolicitudes ? (
          <>
            <div className="canales-mini-section" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => setShowSolicitudes(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '16px', padding: '0 4px 0 0', lineHeight: 1 }}>←</button>
              <span>{t('social.requests')}</span>
              <span style={{ marginLeft: 'auto', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>{pending.length}</span>
            </div>
            {pending.length === 0
              ? <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>{t('social.noRequests')}</div>
              : pending.map(renderConvItem)
            }
          </>
        ) : (
        <>

        {/* Badge de solicituds — visible a dalt de tot si hi ha pendents */}
        {pending.length > 0 && (
          <button onClick={() => setShowSolicitudes(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
            <AppIcon name="mail" size={15} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{t('social.requests')}</span>
            <span style={{ background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>{pending.length}</span>
          </button>
        )}

        {/* Capçalera minimalista: NOM_CARPETA ▾ ........ +  (substitueix "Mensajes") */}
        <div className="canales-mini-section" style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          <button onClick={() => setShowFolderMenu(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', maxWidth: '80%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeFolderObj?.name}</span>
            {dmFolders.isFolderMuted(dmFolders.activeFolder) && <span style={{ display: 'inline-flex', alignItems: 'center' }}><AppIcon name="bellOff" size={10} /></span>}
            <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
          </button>
          <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }} title={t('social.newFolder')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '17px', lineHeight: 1, fontWeight: 400 }}>
            +
          </button>

          {/* Dropdown de carpetes */}
          <AnimatePresence>
            {showFolderMenu && (
              <>
                <div onClick={() => setShowFolderMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  style={{ position: 'absolute', top: '100%', left: '8px', right: 'auto', width: '210px', maxWidth: 'calc(100% - 16px)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 20 }}>
                  {dmFolders.folders.map(f => {
                    const isActiveF = f.id === dmFolders.activeFolder
                    const fMuted = dmFolders.isFolderMuted(f.id)
                    const count = conversations.filter(c => hasMsgs(c) && (c.isAccepted || c.user1_id === user.id) && dmFolders.folderOf(c.id) === f.id).length
                    const dotsOpen = folderDotsId === f.id
                    return (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border)', background: isActiveF ? 'var(--color-primary-light)' : 'transparent', position: 'relative' }}>
                        <button onClick={() => { dmFolders.setActiveFolder(f.id); setShowFolderMenu(false); setFolderDotsId(null) }}
                          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', color: isActiveF ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>({count})</span>
                        </button>
                        {/* ⋮ per carpeta → popover amb silenciar + eliminar */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button onClick={e => { e.stopPropagation(); setFolderDotsId(dotsOpen ? null : f.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-muted)', padding: '8px 10px', lineHeight: 1, fontWeight: 700, opacity: dotsOpen ? 1 : 0.7 }}>
                            ⋮
                          </button>
                          <AnimatePresence>
                            {dotsOpen && (
                              <>
                                <div onClick={() => setFolderDotsId(null)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
                                <motion.div initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                  style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 26, minWidth: '145px', overflow: 'hidden' }}>
                                  <button onClick={() => { toggleFolderMute(f.id); setFolderDotsId(null) }}
                                    style={{ ...miniMenuBtnStyle, borderBottom: f.id !== 'general' ? '0.5px solid var(--color-border)' : 'none' }}>
                                    {fMuted ? <><AppIcon name="bell" size={13} /> {t('social.unmute')}</> : <><AppIcon name="bellOff" size={13} /> {t('social.mute')}</>}
                                  </button>
                                  {f.id !== 'general' && (
                                    <button onClick={() => { setFolderDotsId(null); setShowFolderMenu(false); setDeleteFolderTarget({ id: f.id, name: f.name }); setDeleteFolderInput('') }}
                                      style={{ ...miniMenuBtnStyle, color: 'var(--color-error)' }}>
                                      <AppIcon name="delete" size={13} /> {t('social.delete')}
                                    </button>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Converses de la carpeta activa */}
        {visibleConvs.map(renderConvItem)}

        {loading && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {t('social.loading')}
          </div>
        )}
        {!loading && visibleConvs.length === 0 && pending.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {dmFolders.activeFolder === 'general' ? t('social.noConversations') : t('social.folderEmpty')}
          </div>
        )}
      </>
      )}
      </div>
    </div>

    <AnimatePresence>
      {blockTarget && (
        <BlockUserModal
          username={blockTarget.username}
          onConfirm={async () => {
            await supabase.from('blocks').upsert({ blocker_id: user.id, blocked_id: blockTarget.id })
            // Desfem el seguiment mutu: bloquejar = desconnexió total
            await Promise.all([
              supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', blockTarget.id),
              supabase.from('follows').delete().eq('follower_id', blockTarget.id).eq('following_id', user.id),
            ])
            // NO esborrem la conversa: queda accessible en mode lectura (sense input).
            // Si la tenim oberta, en forcem el remount perquè DMView re-detecti el bloqueig.
            if (activeConv?.id === blockTarget.convId) setBlockBump(b => b + 1)
          }}
          // Si l'usuari accepta reportar després de bloquejar, reobrim el flux de report.
          onReport={() => setReportTarget({ id: blockTarget.id, username: blockTarget.username })}
          onClose={() => setBlockTarget(null)}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {reportTarget && (
        <ReportUserModal
          reportedId={reportTarget.id}
          reportedUsername={reportTarget.username}
          reporterId={user.id}
          onClose={() => setReportTarget(null)}
        />
      )}
    </AnimatePresence>

    {/* Crear carpeta */}
    <AnimatePresence>
      {showCreateFolder && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowCreateFolder(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="folder" size={17} /> {t('social.newFolder')}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>{t('social.newFolderDesc', { n: MAX_SECONDARY_FOLDERS })}</div>
            <input autoFocus value={newFolderName} maxLength={15}
              onChange={e => { setNewFolderName(e.target.value); setFolderError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
              placeholder={t('social.folderNamePlaceholder')}
              style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '11px 13px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }} />
            {folderError && <div style={{ fontSize: '12px', color: 'var(--color-error)', marginTop: '8px' }}>{folderError}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowCreateFolder(false)}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                {t('social.cancel')}
              </button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: newFolderName.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: newFolderName.trim() ? '#010906' : 'var(--color-text-muted)', cursor: newFolderName.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                {t('social.create')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Triar carpeta en acceptar una solicitud */}
    <AnimatePresence>
      {folderPickFor && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { assignToFolder(folderPickFor, 'general'); setFolderPickFor(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>{t('social.chooseFolderTitle')}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>{t('social.chooseFolderDesc')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dmFolders.folders.map(f => (
                <button key={f.id} onClick={() => { assignToFolder(folderPickFor, f.id); setFolderPickFor(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                  <AppIcon name="folder" size={14} /> {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Eliminar carpeta — cal escriure la paraula de confirmació */}
    <AnimatePresence>
      {deleteFolderTarget && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setDeleteFolderTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '400px', width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="delete" size={16} /> {t('social.deleteFolderTitle', { name: deleteFolderTarget.name })}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '14px' }}
              dangerouslySetInnerHTML={{ __html: t('social.deleteFolderWarning') }} />
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}
              dangerouslySetInnerHTML={{ __html: t('social.deleteFolderConfirmPrompt', { word: `<strong style="color:var(--color-error);letter-spacing:0.5px">${confirmWord}</strong>` }) }} />
            <input autoFocus value={deleteFolderInput} onChange={e => setDeleteFolderInput(e.target.value)} placeholder={confirmWord} maxLength={10}
              style={{ width: '100%', background: 'var(--color-bg)', border: `1.5px solid ${deleteFolderInput === confirmWord ? 'var(--color-error)' : 'var(--color-error-border)'}`, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', letterSpacing: '1px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setDeleteFolderTarget(null)}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                {t('social.cancel')}
              </button>
              <button onClick={confirmDeleteFolder} disabled={deleteFolderInput !== confirmWord}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteFolderInput === confirmWord ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteFolderInput === confirmWord ? '#fff' : 'var(--color-text-muted)', cursor: deleteFolderInput === confirmWord ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                {t('social.deleteFolder')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
