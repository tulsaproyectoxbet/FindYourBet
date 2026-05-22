import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import ForwardModal from '../social/ForwardModal'
import ReportPickModal from './ReportPickModal'

const STATUS_CFG = {
  won:     { label: 'Ganada',    color: 'var(--color-primary)',    bg: 'var(--color-primary-light)',  border: 'var(--color-primary-border)' },
  lost:    { label: 'Perdida',   color: 'var(--color-error)',      bg: 'var(--color-error-light)',    border: 'var(--color-error-border)' },
  pending: { label: 'Pendiente', color: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)',        border: 'var(--color-border)' },
}

// isOwner: el propietari del canal no pot reportar els seus propis picks
export default function ChannelBetPost({ messageId, bet, liveStatus, liveReviewStatus, currentUser, isOwner, onOpenPost, timeStr, viewCount = 0 }) {
  const [likeCount, setLikeCount] = useState(0)
  const [hasLiked, setHasLiked] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [showForward, setShowForward] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const status = liveStatus ?? bet.status
  // review_status del pick: null=normal | 'review'=suspès pendent admin | 'cleared'=validat | 'invalid'=invalidat
  const reviewStatus = liveReviewStatus ?? null
  const isUnderReview = reviewStatus === 'review'
  const isInvalid = reviewStatus === 'invalid'

  const cfg = (isUnderReview || isInvalid)
    ? { label: isUnderReview ? '⏸ En revisión' : '❌ Invalidado', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' }
    : STATUS_CFG[status] ?? STATUS_CFG.pending

  useEffect(() => {
    if (!messageId || !currentUser?.id) return
    Promise.all([
      supabase.from('post_likes').select('user_id').eq('message_id', messageId),
      supabase.from('post_comments').select('id').eq('message_id', messageId),
    ]).then(([{ data: likes }, { data: comments }]) => {
      setLikeCount((likes || []).length)
      setHasLiked((likes || []).some(l => l.user_id === currentUser.id))
      setCommentCount((comments || []).length)
    })
  }, [messageId, currentUser?.id])

  const handleLike = async (e) => {
    e.stopPropagation()
    const nowLiked = !hasLiked
    setHasLiked(nowLiked)
    setLikeCount(prev => prev + (nowLiked ? 1 : -1))
    if (nowLiked) {
      await supabase.from('post_likes').insert({ message_id: messageId, user_id: currentUser.id })
    } else {
      await supabase.from('post_likes').delete().eq('message_id', messageId).eq('user_id', currentUser.id)
    }
  }

  const isPhoto = !!bet.imageUrl

  const forwardContent = `[BET]:${JSON.stringify({
    id: bet.id, event: bet.event, pick: bet.pick,
    odds: bet.odds, stake: bet.stake, sport: bet.sport,
    market: bet.market, date: bet.date, status: bet.status,
    bookie: bet.bookie || null, imageUrl: bet.imageUrl || null,
  })}`

  return (
    <>
      <div
        onClick={onOpenPost}
        style={{
          background: 'var(--color-bg)',
          border: `0.5px solid ${cfg.border}`,
          borderLeft: `3px solid ${cfg.color}`,
          borderRadius: 'var(--radius-lg)',
          minWidth: '240px',
          maxWidth: '300px',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {/* Foto del ticket — visible directament al chat */}
        {isPhoto && (
          <img
            src={bet.imageUrl}
            alt="ticket"
            style={{ display: 'block', width: '100%', maxHeight: '200px', objectFit: 'cover' }}
          />
        )}

        {/* BET INFO */}
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Pick</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: cfg.bg, color: cfg.color, fontWeight: 700, border: `0.5px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
          </div>

          {!isPhoto && (
            <>
              <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.3, marginBottom: '6px' }}>{bet.event}</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[bet.sport, bet.market].filter(Boolean).map((t, i) => (
                  <span key={i} style={{ padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t}</span>
                ))}
                {bet.pick && bet.pick !== '-' && (
                  <span style={{ padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{bet.pick}</span>
                )}
              </div>
            </>
          )}

          {(() => {
            const fmtDate = (d) => {
              const dt = new Date(d)
              const pad = n => String(n).padStart(2, '0')
              return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
            }
            const stats = [
              { label: 'Cuota', value: parseFloat(bet.odds || 0).toFixed(2) },
              { label: 'Stake', value: `${bet.stake}` },
              ...(bet.date ? [{ label: 'Fecha', value: fmtDate(bet.date) }] : []),
              ...(bet.bookie ? [{ label: 'Bookie', value: bet.bookie }] : []),
            ]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '2px 0' }}>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* ACTION BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0px', padding: '4px 6px 6px', borderTop: '0.5px solid var(--color-border)' }}>
          <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: hasLiked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontWeight: hasLiked ? 700 : 400, borderRadius: 'var(--radius-md)' }}>
            <span>{hasLiked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span style={{ fontSize: '11px' }}>{likeCount}</span>}
          </motion.button>
          <button onClick={(e) => { e.stopPropagation(); onOpenPost() }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
            <span>💬</span>
            {commentCount > 0 && <span style={{ fontSize: '11px' }}>{commentCount}</span>}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowForward(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
            <span>↗️</span>
            <span>Reenviar</span>
          </button>
          {/* Botó de reportar — visible per a no-propietaris. Ocult si el pick ja és invalid. */}
          {!isOwner && !isInvalid && (
            <button onClick={(e) => { e.stopPropagation(); setShowReport(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: isUnderReview ? 'var(--color-warning)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
              <span>🚩</span>
            </button>
          )}
          {timeStr && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.6, paddingRight: '4px' }}>
              {viewCount > 0 ? `👁 ${viewCount} · ` : ''}{timeStr}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForward && (
          <ForwardModal
            content={forwardContent}
            fromChannelName="Pick"
            currentUser={currentUser}
            onClose={() => setShowForward(false)}
          />
        )}
        {showReport && (
          <ReportPickModal
            bet={bet}
            currentUser={currentUser}
            onClose={() => setShowReport(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
