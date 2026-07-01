import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
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
import { isAdminUserId } from '../../../lib/adminUsers'
import { formatMsgPreview } from '../../../lib/formatMsgPreview'
import '../dashboard.css'

function miniTimeAgo(ts) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

export default function Social({ user, initialDMUserId, onNavigateToChannel, onActiveUnreadChange, onRefreshUnread }) {
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
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderError, setFolderError] = useState('')
  const [folderPickFor, setFolderPickFor] = useState(null) // convId que s'acaba d'acceptar
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null) // { id, name }
  const [deleteFolderInput, setDeleteFolderInput] = useState('')
  const [miniMoveId, setMiniMoveId] = useState(null) // conv amb submenú "Mover a carpeta" obert
  const [folderActionsId, setFolderActionsId] = useState(null) // carpeta amb accions (silenciar/eliminar) obertes
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

  // Confirmació d'eliminar carpeta (has escrit ELIMINAR): esborra la carpeta i tots els xats de dins.
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
    const [{ data }, { data: myBlocks }, { data: blockedByOthers }] = await Promise.all([
      supabase.from('profiles').select('id, username, name, is_verified').or(`username.ilike.%${q}%,name.ilike.%${q}%`).neq('id', user.id).limit(20),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
    ])
    const hidden = new Set([
      ...(myBlocks || []).map(b => b.blocked_id),
      ...(blockedByOthers || []).map(b => b.blocker_id),
    ])
    // Exclou admins (fyourbet) i usuaris bloquejats
    setSearchResults((data || []).filter(u => !hidden.has(u.id) && !isAdminUserId(u.id)).slice(0, 10))
    setSearching(false)
  }

  const handleStartDM = async (userId) => {
    const mutual = isFollowing(userId) && isFollower(userId)
    const conv = await startConversation(userId, mutual)
    if (conv) {
      setActiveConv(conv)
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
  const pending = conversations.filter(c => !c.isAccepted && c.user1_id !== user.id && hasMsgs(c))
  const active = conversations.filter(c => (c.isAccepted || c.user1_id === user.id) && hasMsgs(c))
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
    const timeStr = miniTimeAgo(c.lastMessageAt)
    return (
      <div key={c.id} className={`canales-mini-item${isActive ? ' active' : ''}`}>
        <div onClick={() => handleOpenConv(c)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
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
                {cpinned && <span style={{ fontSize: '10px', marginRight: '3px' }}>📌</span>}
                {c.otherUsername}
              </span>
              <span className="canales-mini-time">{timeStr}</span>
            </div>
            <div className="canales-mini-preview">
              {cmuted && <span style={{ marginRight: '4px' }}>🔕</span>}
              {c.lastMessageIsOwn && !preview ? null : c.lastMessageIsOwn ? `Tú: ${preview}` : preview || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sin mensajes</span>}
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
                    {cpinned ? '📍 Desanclar' : '📌 Anclar'}
                  </button>
                  <button onClick={() => {
                    if (cmuted) { unmute(dmKey); setMiniMenuId(null) }
                    else { setMiniMuteId(c.id); setMiniMenuId(null) }
                  }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                    {cmuted ? '🔔 Activar notificaciones' : '🔕 Silenciar'}
                  </button>
                  <button onClick={() => { setMiniMoveId(c.id); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                    📁 Mover a carpeta
                  </button>
                  <button onClick={() => {
                    if (window.confirm(`¿Eliminar la conversación con ${c.otherUsername}?`)) {
                      blockUser(c.id)
                      if (activeConv?.id === c.id) { setView('list'); setActiveConv(null) }
                    }
                    setMiniMenuId(null)
                  }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-error)' }}>
                    🗑️ Eliminar chat
                  </button>
                  <button onClick={() => { setBlockTarget({ id: c.otherId, username: c.otherUsername, convId: c.id }); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-error)' }}>
                    🚫 Bloquear
                  </button>
                  <button onClick={() => { setReportTarget({ id: c.otherId, username: c.otherUsername }); setMiniMenuId(null) }}
                    style={{ ...miniMenuBtnStyle, color: 'var(--color-warning, #f59e0b)' }}>
                    🚩 Reportar
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
                  <div style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '0.5px solid var(--color-border)' }}>Mover a</div>
                  {dmFolders.folders.map((f, i) => {
                    const here = dmFolders.folderOf(c.id) === f.id
                    return (
                      <button key={f.id} onClick={() => { assignToFolder(c.id, f.id); setMiniMoveId(null) }}
                        style={{ ...miniMenuBtnStyle, borderBottom: i < dmFolders.folders.length - 1 ? '0.5px solid var(--color-border)' : 'none', color: here ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: here ? 700 : 400 }}>
                        {here ? '✓ ' : '📁 '}{f.name}
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
              if (window.confirm(`¿Eliminar la conversación con ${activeConv.otherUsername}?`)) {
                blockUser(activeConv.id)
                setView('list'); setActiveConv(null)
              }
            }}
            onBlock={() => setBlockTarget({ id: activeConv.otherId, username: activeConv.otherUsername, convId: activeConv.id })}
            onReport={() => setReportTarget({ id: activeConv.otherId, username: activeConv.otherUsername })}
            onViewProfile={(userId) => { setActiveConv(null); setActiveProfile(userId); setView('profile') }}
            onAccept={async (id) => {
              await acceptConversation(id)
              setActiveConv(prev => prev ? { ...prev, isAccepted: true } : prev)
              // Si hi ha carpetes secundàries, pregunta on posar-lo; si no, va a General.
              if (dmFolders.folders.length > 1) setFolderPickFor(id)
              else assignToFolder(id, 'general')
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
              onBlock={(userId) => { alert('Usuario bloqueado.') }}
              onReport={() => {}}
              onViewUser={handleOpenProfile}
            />
          </div>
        ) : (
          // Cercador centrat + resultats — no hi ha DM ni perfil obert
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflowY: 'auto', padding: '0 40px', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', maxWidth: '380px', paddingTop: '18%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ fontSize: '52px', opacity: 0.2 }}>💬</div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)', opacity: 0.7, textAlign: 'center' }}>
                  {active.length + pending.length > 0 ? 'Selecciona o busca una conversación' : 'Busca un usuario para empezar'}
                </div>
              </div>
              <input
                type="text"
                placeholder="🔍 Buscar usuario por nombre o @username..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                maxLength={50}
                style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 16px', borderRadius: 'var(--radius-lg)', outline: 'none', boxSizing: 'border-box' }}
              />
              {searchQuery && (
                <div style={{ marginTop: '10px' }}>
                  {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>Buscando...</div>}
                  {!searching && searchResults.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>No se encontraron usuarios</div>
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
                          {isMutual(u.id) ? '👥 Amigos' : isFollowing(u.id) ? 'Siguiendo' : '+ Seguir'}
                        </button>
                        <button onClick={() => handleStartDM(u.id)}
                          style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                          💬
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

        {/* Solicituds pendents — mateix format que les converses normals (no es filtren per carpeta) */}
        {pending.length > 0 && (
          <div>
            <div className="canales-mini-section">Solicitudes ({pending.length})</div>
            {pending.map(renderConvItem)}
          </div>
        )}

        {/* Capçalera minimalista: NOM_CARPETA ▾ ........ +  (substitueix "Mensajes") */}
        <div className="canales-mini-section" style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          <button onClick={() => { setShowFolderMenu(v => !v); setFolderActionsId(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', maxWidth: '80%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeFolderObj?.name}</span>
            {dmFolders.isFolderMuted(dmFolders.activeFolder) && <span style={{ fontSize: '10px' }}>🔕</span>}
            <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
          </button>
          <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }} title="Crear carpeta"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '17px', lineHeight: 1, fontWeight: 400 }}>
            +
          </button>

          {/* Dropdown de carpetes */}
          <AnimatePresence>
            {showFolderMenu && (
              <>
                <div onClick={() => setShowFolderMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  style={{ position: 'absolute', top: '100%', left: '8px', right: '8px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 20, overflow: 'hidden' }}>
                  {dmFolders.folders.map(f => {
                    const isActiveF = f.id === dmFolders.activeFolder
                    const fMuted = dmFolders.isFolderMuted(f.id)
                    const actionsOpen = folderActionsId === f.id
                    const count = conversations.filter(c => hasMsgs(c) && (c.isAccepted || c.user1_id === user.id) && dmFolders.folderOf(c.id) === f.id).length
                    return (
                      <div key={f.id} style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: isActiveF ? 'var(--color-primary-light)' : 'transparent' }}>
                          <button onClick={() => { dmFolders.setActiveFolder(f.id); setShowFolderMenu(false) }}
                            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', color: isActiveF ? 'var(--color-primary)' : 'var(--color-text)' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            {fMuted && <span style={{ fontSize: '10px' }}>🔕</span>}
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>({count})</span>
                          </button>
                          <button onClick={() => setFolderActionsId(actionsOpen ? null : f.id)} title="Opciones"
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '8px 10px', color: 'var(--color-text-muted)', fontWeight: 700, lineHeight: 1 }}>
                            ⋮
                          </button>
                        </div>
                        {/* Accions de la carpeta (silenciar / eliminar) */}
                        {actionsOpen && (
                          <div style={{ background: 'var(--color-bg-soft)', borderTop: '0.5px solid var(--color-border)' }}>
                            <button onClick={() => { toggleFolderMute(f.id); setFolderActionsId(null) }}
                              style={{ ...miniMenuBtnStyle, padding: '10px 14px', borderBottom: f.id !== 'general' ? '0.5px solid var(--color-border)' : 'none' }}>
                              {fMuted ? 'Activar' : 'Silenciar'}
                            </button>
                            {f.id !== 'general' && (
                              <button onClick={() => { setShowFolderMenu(false); setFolderActionsId(null); setDeleteFolderTarget({ id: f.id, name: f.name }); setDeleteFolderInput('') }}
                                style={{ ...miniMenuBtnStyle, padding: '10px 14px', color: 'var(--color-error)' }}>
                                🗑️ Eliminar carpeta
                              </button>
                            )}
                          </div>
                        )}
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
            Cargando...
          </div>
        )}
        {!loading && visibleConvs.length === 0 && pending.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {dmFolders.activeFolder === 'general' ? 'Sin conversaciones todavía' : 'Esta carpeta está vacía'}
          </div>
        )}
      </div>
    </div>

    <AnimatePresence>
      {blockTarget && (
        <BlockUserModal
          username={blockTarget.username}
          onConfirm={async () => {
            await supabase.from('blocks').upsert({ blocker_id: user.id, blocked_id: blockTarget.id })
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
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>📁 Nueva carpeta</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>Organiza tus chats. Máximo {MAX_SECONDARY_FOLDERS} carpetas.</div>
            <input autoFocus value={newFolderName} maxLength={20}
              onChange={e => { setNewFolderName(e.target.value); setFolderError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
              placeholder="Nombre de la carpeta"
              style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '11px 13px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }} />
            {folderError && <div style={{ fontSize: '12px', color: 'var(--color-error)', marginTop: '8px' }}>{folderError}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowCreateFolder(false)}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                Cancelar
              </button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: newFolderName.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: newFolderName.trim() ? '#010906' : 'var(--color-text-muted)', cursor: newFolderName.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Crear
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
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>¿A qué carpeta?</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>Elige dónde guardar esta conversación.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dmFolders.folders.map(f => (
                <button key={f.id} onClick={() => { assignToFolder(folderPickFor, f.id); setFolderPickFor(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                  📁 {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Eliminar carpeta — cal escriure ELIMINAR */}
    <AnimatePresence>
      {deleteFolderTarget && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setDeleteFolderTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '400px', width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-error)' }}>🗑️ Eliminar "{deleteFolderTarget.name}"</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
              Se eliminará la carpeta y <strong>todos los chats que contiene</strong>. Esta acción es irreversible.
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Escribe <strong style={{ color: 'var(--color-error)', letterSpacing: '0.5px' }}>ELIMINAR</strong> para confirmar:
            </div>
            <input autoFocus value={deleteFolderInput} onChange={e => setDeleteFolderInput(e.target.value)} placeholder="ELIMINAR" maxLength={8}
              style={{ width: '100%', background: 'var(--color-bg)', border: `1.5px solid ${deleteFolderInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-error-border)'}`, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', letterSpacing: '1px' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setDeleteFolderTarget(null)}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                Cancelar
              </button>
              <button onClick={confirmDeleteFolder} disabled={deleteFolderInput !== 'ELIMINAR'}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteFolderInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteFolderInput === 'ELIMINAR' ? '#fff' : 'var(--color-text-muted)', cursor: deleteFolderInput === 'ELIMINAR' ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Eliminar carpeta
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
