import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function timeAgo(ts) {
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

const STATUS_CFG = {
  won:     { label: 'Ganada',    color: 'var(--color-primary)',    bg: 'var(--color-primary-light)',  border: 'var(--color-primary-border)' },
  lost:    { label: 'Perdida',   color: 'var(--color-error)',      bg: 'var(--color-error-light)',    border: 'var(--color-error-border)' },
  pending: { label: 'Pendiente', color: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)',        border: 'var(--color-border)' },
}

function ActionBtn({ icon, label, onClick, active }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: active ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontWeight: active ? 700 : 400, borderRadius: 'var(--radius-md)', transition: 'color 0.15s' }}>
      <span style={{ fontSize: '15px', lineHeight: 1 }}>{icon}</span>
      {label !== '' && label !== undefined && label !== null && <span>{label}</span>}
    </motion.button>
  )
}

export default function FeedCard({ post, currentUserId, onLike, onComment, onNavigateToChannel, onReport }) {
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [comments, setComments] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [shared, setShared] = useState(false)

  const { bet, profile, channel, likeCount, commentCount, hasLiked, created_at } = post
  const cfg = STATUS_CFG[bet?.status] ?? STATUS_CFG.pending
  const initials = (profile?.username || '?')[0].toUpperCase()

  const handleOpenComments = async () => {
    setShowComments(true)
    if (comments === null) {
      setLoadingComments(true)
      const data = await onComment.fetch(post.id)
      setComments(data)
      setLoadingComments(false)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) return
    const text = commentText.trim()
    setCommentText('')
    await onComment.add(post.id, text)
    setComments(prev => [...(prev || []), {
      id: `tmp-${Date.now()}`,
      user_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      profile: null,
    }])
  }

  const handleShare = () => {
    const url = channel?.invite_code
      ? `${window.location.origin}/dashboard?canal=${channel.invite_code}`
      : window.location.href
    navigator.clipboard.writeText(url)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '12px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px 10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>@{profile?.username || 'usuario'}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span>{timeAgo(created_at)}</span>
              {channel && (
                <>
                  <span>·</span>
                  <button onClick={() => onNavigateToChannel?.(channel)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px', color: 'var(--color-primary)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    #{channel.name}
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px' }}>
              ⋮
            </button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  style={{ position: 'absolute', top: '30px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '160px', overflow: 'hidden' }}>
                  <button onClick={() => { onReport?.(post.id); setShowMenu(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-error)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                    <span>🚩</span><span>Reportar</span>
                  </button>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* BET CARD */}
        <div style={{ margin: '0 12px 10px', background: 'var(--color-bg-soft)', border: `0.5px solid ${cfg.border}`, borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${cfg.color}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3, flex: 1 }}>{bet?.event}</div>
              <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[bet?.sport, bet?.market].filter(Boolean).map((t, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t}</span>
              ))}
              {bet?.pick && (
                <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{bet.pick}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Cuota</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{parseFloat(bet?.odds || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Stake</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>S{bet?.stake}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Fecha</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {bet?.date ? new Date(bet.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 10px', borderTop: '0.5px solid var(--color-border)' }}>
          <ActionBtn active={hasLiked} icon={hasLiked ? '❤️' : '🤍'} label={likeCount || ''} onClick={() => onLike(post.id, hasLiked)} />
          <ActionBtn icon="💬" label={commentCount || ''} onClick={handleOpenComments} />
          <ActionBtn icon={shared ? '✓' : '🔗'} label={shared ? 'Copiado' : 'Compartir'} onClick={handleShare} active={shared} />
          {channel && (
            <button onClick={() => onNavigateToChannel?.(channel)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
              Ver canal →
            </button>
          )}
        </div>
      </motion.div>

      {/* COMMENTS SLIDE-UP */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => setShowComments(false)}
              style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51, background: 'var(--color-bg)', borderRadius: '20px 20px 0 0', padding: '0 0 16px', maxHeight: '65vh', display: 'flex', flexDirection: 'column' }}>

              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--color-border)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Comentarios {commentCount > 0 && `(${commentCount})`}</div>
                <button onClick={() => setShowComments(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '2px 4px' }}>×</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {loadingComments ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>⏳ Cargando...</div>
                ) : (comments || []).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>💬</div>
                    <div>Sin comentarios aún. ¡Sé el primero!</div>
                  </div>
                ) : (comments || []).map((c, i) => (
                  <div key={c.id || i} style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
                      {c.profile?.avatar_url
                        ? <img src={c.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (c.profile?.username || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>@{c.profile?.username || 'usuario'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text)' }}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', padding: '14px 20px 0', borderTop: '0.5px solid var(--color-border)', marginTop: '14px' }}>
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Añade un comentario..."
                  style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none' }} />
                <button onClick={handleAddComment} disabled={!commentText.trim()}
                  style={{ background: commentText.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: commentText.trim() ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '10px 16px', borderRadius: 'var(--radius-md)', cursor: commentText.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.15s' }}>
                  Enviar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
