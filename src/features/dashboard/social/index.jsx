import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useDMs } from './hooks/useDMs'
import { useFollow } from './hooks/useFollow'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
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

  const pending = conversations.filter(c => !c.isAccepted && c.user1_id !== user.id)
  const active = conversations.filter(c => c.isAccepted || c.user1_id === user.id)
  const sortedConvs = [...active].sort((a, b) => {
    const aPin = isDMPinned(a.id), bPin = isDMPinned(b.id)
    if (aPin && !bPin) return -1
    if (!aPin && bPin) return 1
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  })
  const miniMenuBtnStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)', gap: '6px' }

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
            onViewProfile={(userId) => { setActiveProfile(userId); setView('profile') }}
            onAccept={async (id) => {
              await acceptConversation(id)
              setActiveConv(prev => prev ? { ...prev, isAccepted: true } : prev)
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

        {/* Solicituds pendents */}
        {pending.length > 0 && (
          <div>
            <div className="canales-mini-section">Solicitudes ({pending.length})</div>
            {pending.map(c => (
              <div key={c.id} className="canales-mini-item" style={{ borderLeft: '2px solid var(--color-primary)' }}>
                <div onClick={() => handleOpenConv(c)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div className="canales-mini-avatar" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {c.otherAvatarUrl
                      ? <img src={c.otherAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (c.otherUsername || '?')[0].toUpperCase()}
                  </div>
                  <div className="canales-mini-body">
                    <div className="canales-mini-row">
                      <span className="canales-mini-name">{c.otherUsername}</span>
                    </div>
                    <div className="canales-mini-preview" style={{ fontStyle: 'italic' }}>quiere enviarte un mensaje</div>
                  </div>
                </div>
                {/* Botons acceptar/rebutjar compactes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignSelf: 'center' }}>
                  <button onClick={() => acceptConversation(c.id)}
                    style={{ padding: '3px 8px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    ✓
                  </button>
                  <button onClick={() => blockUser(c.id)}
                    style={{ padding: '3px 8px', background: 'var(--color-error-light)', color: 'var(--color-error)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Converses actives */}
        {sortedConvs.length > 0 && (
          <div>
            <div className="canales-mini-section">Mensajes</div>
            {sortedConvs.map(c => {
              const dmKey = `dm_${c.id}`
              const cmuted = isMuted(dmKey)
              const cpinned = isDMPinned(c.id)
              const isActive = c.id === activeConv?.id
              const menuOpen = miniMenuId === c.id
              const muteOpen = miniMuteId === c.id
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
                    </AnimatePresence>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {loading && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Cargando...
          </div>
        )}
        {!loading && active.length === 0 && pending.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Sin conversaciones todavía
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
    </>
  )
}
