import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ForwardModal from '../social/ForwardModal'
import PostModal from './PostModal'
import { useProfileNav } from '../../../contexts/ProfileNavContext'
import Username from '../../../components/ui/Username'

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
  void:    { label: 'Nula',      color: 'var(--color-info)',       bg: 'var(--color-info-light)',     border: 'var(--color-info-border)' },
  pending: { label: 'Pendiente', color: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)',        border: 'var(--color-border)' },
}

export default function FeedCard({ post, currentUser, onLike, onNavigateToChannel, onReport }) {
  const [showModal, setShowModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showForward, setShowForward] = useState(false)

  const openProfile = useProfileNav()
  const { bet, profile, channel, likeCount, commentCount, hasLiked, created_at } = post
  const cfg = STATUS_CFG[bet?.status] ?? STATUS_CFG.pending
  const initials = (profile?.username || '?')[0].toUpperCase()

  const forwardContent = `[BET]:${JSON.stringify({
    id: bet?.id, event: bet?.event, pick: bet?.pick,
    odds: bet?.odds, stake: bet?.stake, sport: bet?.sport,
    market: bet?.market, date: bet?.date, status: bet?.status,
  })}`

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '12px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px 10px' }}>
          <div onClick={() => openProfile(post.user_id)}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
            {initials}
            {profile?.avatar_url && (
              <img src={profile.avatar_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div onClick={() => openProfile(post.user_id)}
              style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2, cursor: 'pointer', display: 'inline-block' }}>
              <Username username={profile?.username || 'usuario'} isVerified={profile?.is_verified} size="sm" />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span>{timeAgo(created_at)}</span>
              {channel && (
                <>
                  <span>·</span>
                  <button onClick={() => onNavigateToChannel?.(channel)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px', color: 'var(--color-primary)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    {channel.name}
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

        {/* BET CARD — clickable to open PostModal */}
        <div onClick={() => setShowModal(true)}
          style={{ margin: '0 12px 10px', background: 'var(--color-bg-soft)', border: `0.5px solid ${cfg.border}`, borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${cfg.color}`, overflow: 'hidden', cursor: 'pointer' }}>
          {bet?.imageUrl && (
            <img src={bet.imageUrl} alt="Pick" style={{ display: 'block', width: '100%', maxHeight: '220px', objectFit: 'cover' }} />
          )}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3, flex: 1 }}>{bet?.event}</div>
              <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            </div>
            {!bet?.imageUrl && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[bet?.sport, bet?.market].filter(Boolean).map((t, i) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t}</span>
                ))}
                {bet?.pick && bet.pick !== '-' && (
                  <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{bet.pick}</span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Cuota</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{parseFloat(bet?.odds || 0).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Stake</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{bet?.stake}</div>
              </div>
              {!bet?.imageUrl && (
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Fecha</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {bet?.date ? new Date(bet.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              )}
              {bet?.bookie && (
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Bookie</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>{bet.bookie}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ACTION BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 10px', borderTop: '0.5px solid var(--color-border)' }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => onLike(post.id, hasLiked)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: hasLiked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontWeight: hasLiked ? 700 : 400, borderRadius: 'var(--radius-md)' }}>
            <span>{hasLiked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span style={{ fontSize: '13px' }}>{likeCount}</span>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
            <span>💬</span>
            {commentCount > 0 && <span style={{ fontSize: '13px' }}>{commentCount}</span>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowForward(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '15px' }}>↩</span>
            <span>Reenviar</span>
          </motion.button>
          {channel && (
            <button onClick={() => onNavigateToChannel?.(channel)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
              Ver canal →
            </button>
          )}
        </div>
      </motion.div>

      {/* POST MODAL */}
      <AnimatePresence>
        {showModal && (
          <PostModal messageId={post.id} currentUser={currentUser} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>

      {/* FORWARD MODAL */}
      <AnimatePresence>
        {showForward && (
          <ForwardModal
            content={forwardContent}
            fromChannelName={channel?.name || ''}
            currentUser={currentUser}
            onClose={() => setShowForward(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
