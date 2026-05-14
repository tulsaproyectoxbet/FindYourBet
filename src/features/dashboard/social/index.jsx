import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useDMs } from './hooks/useDMs'
import { useFollow } from './hooks/useFollow'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import DMView from './DMView'
import ProfileView from './ProfileView'

export default function Social({ user }) {
  const { conversations, loading, unreadCount, startConversation, acceptConversation, sendMessage, fetchMessages, blockUser } = useDMs(user.id)
  const { isFollowing, isFollower, follow, unfollow } = useFollow(user.id)
  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const [openMuteMenu, setOpenMuteMenu] = useState(null)

  const [view, setView] = useState('list') // 'list' | 'dm' | 'profile' | 'search'
  const [activeConv, setActiveConv] = useState(null)
  const [activeProfile, setActiveProfile] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, name')
      .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
      .neq('id', user.id)
      .limit(10)
    setSearchResults(data || [])
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

  if (view === 'dm' && activeConv) {
    return (
      <DMView
        conversation={activeConv}
        currentUser={user}
        onBack={() => setView('list')}
        onSend={sendMessage}
        onFetchMessages={fetchMessages}
        onBlock={(id) => { blockUser(id); setView('list') }}
        onReport={() => alert('Conversación reportada.')}
      />
    )
  }

  if (view === 'profile' && activeProfile) {
    return (
      <ProfileView
        userId={activeProfile}
        currentUser={user}
        onBack={() => setView(view === 'profile' ? 'search' : 'list')}
        onStartDM={handleStartDM}
        isFollowing={isFollowing(activeProfile)}
        isFollower={isFollower(activeProfile)}
        onFollow={follow}
        onUnfollow={unfollow}
      />
    )
  }

  const pending = conversations.filter(c => !c.isAccepted && c.user1_id !== user.id)
  const active = conversations.filter(c => c.isAccepted || c.user1_id === user.id)

  return (
    <motion.div key="social" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Social</h2>
        <p>Mensajes directos y perfiles de la comunidad.</p>
      </div>

      {/* BUSCADOR */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="🔍 Buscar usuario por nombre o @username..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 16px', borderRadius: 'var(--radius-lg)', outline: 'none', boxSizing: 'border-box' }}
        />

        <AnimatePresence>
          {searchQuery && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginTop: '8px', overflow: 'hidden' }}>
              {searching && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Buscando...</div>}
              {!searching && searchResults.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>No se encontraron usuarios</div>
              )}
              {searchResults.map((u, i) => (
                <div key={u.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < searchResults.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer' }}
                  onClick={() => { handleOpenProfile(u.id); setSearchQuery(''); setSearchResults([]) }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                    {(u.username || u.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.name || u.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>@{u.username}</div>
                  </div>
                  {isFollowing(u.id) && (
                    <span style={{ fontSize: '11px', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)' }}>Siguiendo</span>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SOL·LICITUDS PENDENTS */}
      {pending.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Solicitudes pendientes ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pending.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                  {(c.otherUsername || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>@{c.otherUsername}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>quiere enviarte un mensaje</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => blockUser(c.id)}
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                    Rechazar
                  </button>
                  <button onClick={() => acceptConversation(c.id)}
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    Aceptar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONVERSES */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
          Mensajes directos
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>⏳ Cargando...</div>
        ) : active.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin mensajes todavía</div>
            <div style={{ fontSize: '13px' }}>Busca un usuario arriba para empezar a chatear.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {active.map(c => {
              const dmKey = `dm_${c.id}`
              const muted = isMuted(dmKey)
              return (
                <div key={c.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary-border)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                  <div onClick={() => handleOpenConv(c)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '44px', height: '44px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, color: 'var(--color-primary)', opacity: muted ? 0.5 : 1 }}>
                        {(c.otherUsername || '?')[0].toUpperCase()}
                      </div>
                      {c.unread > 0 && !muted && (
                        <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '18px', height: '18px', background: 'var(--color-error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                          {c.unread > 9 ? '9+' : c.unread}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, opacity: muted ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <div style={{ fontWeight: c.unread > 0 && !muted ? 700 : 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          @{c.otherUsername}
                          {muted && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>🔕 {muteLabel(dmKey)}</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {new Date(c.lastMessageAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: c.unread > 0 && !muted ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: c.unread > 0 && !muted ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lastMessageIsOwn ? 'Tú: ' : ''}{c.lastMessage || 'Sin mensajes'}
                      </div>
                    </div>
                  </div>

                  {/* Botó silenciar DM */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setOpenMuteMenu(openMuteMenu === c.id ? null : c.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', opacity: muted ? 0.5 : 0.7, borderRadius: 'var(--radius-sm)' }}>
                      {muted ? '🔕' : '🔔'}
                    </button>
                    <AnimatePresence>
                      {openMuteMenu === c.id && (
                        <>
                          <div onClick={() => setOpenMuteMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                          <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                            style={{ position: 'absolute', top: '32px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '160px', overflow: 'hidden' }}>
                            {muted && (
                              <button onClick={() => { unmute(dmKey); setOpenMuteMenu(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                                🔔 Activar notificaciones
                              </button>
                            )}
                            {MUTE_DURATIONS.map((d, i) => (
                              <button key={i} onClick={() => { mute(dmKey, d.ms); setOpenMuteMenu(null) }}
                                style={{ display: 'flex', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
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
      </div>
    </motion.div>
  )
}