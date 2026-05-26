import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { VoicePlayer } from '../VoiceMessage'

export function ImageMessage({ url, isGif }) {
  const [open, setOpen] = useState(false)
  const imgStyle = isGif
    ? { display: 'block', maxWidth: '240px', maxHeight: '200px', borderRadius: 'var(--radius-md)', objectFit: 'contain', cursor: 'zoom-in' }
    : { display: 'block', minWidth: '160px', minHeight: '120px', maxWidth: '100%', maxHeight: '340px', borderRadius: 'var(--radius-md)', cursor: 'zoom-in' }
  return (
    <>
      <img src={url} alt={isGif ? 'gif' : 'img'} style={imgStyle} onClick={() => setOpen(true)} />
      {open && createPortal(
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '20px' }}>
          <img src={url} alt=""
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setOpen(false)}
            style={{ position: 'fixed', top: '16px', right: '16px', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
            ×
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

export function parseBetMessage(content) {
  try { return JSON.parse(content.replace('[BET]:', '')) } catch { return null }
}

export function BetCard({ bet, timeStr }) {
  const [liveStatus, setLiveStatus] = useState(bet.status)

  useEffect(() => {
    if (!bet.id || bet.status !== 'pending') return
    supabase.from('bets').select('status').eq('id', bet.id).single()
      .then(({ data }) => { if (data?.status) setLiveStatus(data.status) })
  }, [bet.id, bet.status])

  // 'void' = pick nul (anul·lat, diners retornats) — apareix en blau
  const statusColor =
    liveStatus === 'won'  ? 'var(--color-primary)'
    : liveStatus === 'lost' ? 'var(--color-error)'
    : liveStatus === 'void' ? 'var(--color-info)'
    : 'var(--color-text-muted)'
  const statusLabel =
    liveStatus === 'won'  ? '✓ Ganada'
    : liveStatus === 'lost' ? '✗ Perdida'
    : liveStatus === 'void' ? '● Nula'
    : '⏳ Pendiente'
  const statusBg =
    liveStatus === 'won'  ? 'var(--color-primary-light)'
    : liveStatus === 'lost' ? 'var(--color-error-light)'
    : liveStatus === 'void' ? 'var(--color-info-light)'
    : 'var(--color-bg-soft)'

  const isPhoto = !!bet.imageUrl

  const statsItems = [
    !isPhoto && bet.pick && bet.pick !== '-' ? { label: 'Pick', value: bet.pick } : null,
    { label: 'Cuota', value: parseFloat(bet.odds).toFixed(2) },
    { label: 'Stake', value: `${bet.stake}` },
    !isPhoto ? { label: 'Fecha', value: new Date(bet.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } : null,
    bet.bookie ? { label: 'Bookie', value: bet.bookie } : null,
  ].filter(Boolean)

  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', minWidth: '240px', maxWidth: '300px', overflow: 'hidden' }}>
      {isPhoto && (
        <img src={bet.imageUrl} alt="ticket" style={{ display: 'block', width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
      )}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Pick</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: statusBg, color: statusColor, fontWeight: 700, border: `0.5px solid ${statusColor}` }}>
            {statusLabel}
          </span>
        </div>
        {!isPhoto && (
          <>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{bet.event}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
              {bet.sport} · {bet.market}
            </div>
          </>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {statsItems.map((s, i) => (
            <div key={i} style={{ background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{s.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>{s.value}</div>
            </div>
          ))}
        </div>
        {timeStr && (
          <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.65 }}>
            {timeStr}
          </div>
        )}
      </div>
    </div>
  )
}

export function isSingleEmoji(content) {
  const t = content.trim()
  if (!t || t.startsWith('[')) return false
  try {
    const segs = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)]
    return segs.length === 1 && /\p{Emoji}/u.test(t)
  } catch {
    return /^\p{Emoji_Presentation}️?$/u.test(t)
  }
}

export function ProfileCard({ profileId, profileUsername, onViewProfile, timeStr, viewCount = 0 }) {
  const hasMeta = timeStr || viewCount > 0
  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', minWidth: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: hasMeta ? '8px' : '0' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
          {(profileUsername || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{profileUsername}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tipster · FYB</div>
        </div>
        <button onClick={() => onViewProfile?.(profileId)}
          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          Ver →
        </button>
      </div>
      {hasMeta && (
        <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.7 }}>
          {viewCount > 0 ? `👁 ${viewCount} · ` : ''}{timeStr}
        </div>
      )}
    </div>
  )
}

export function renderMessage(content, onInternalLink, isOwnerMsg = false, onViewProfile = null, timeStr = '', viewCount = 0) {
  const linkColor = isOwnerMsg ? '#010906' : 'var(--color-primary)'

  if (content.startsWith('[PROFILE]:')) {
    const rest = content.replace('[PROFILE]:', '')
    const idx = rest.indexOf(':')
    const profileId = idx >= 0 ? rest.slice(0, idx) : rest
    const profileUsername = idx >= 0 ? rest.slice(idx + 1) : '?'
    return <ProfileCard profileId={profileId} profileUsername={profileUsername} onViewProfile={onViewProfile} timeStr={timeStr} viewCount={viewCount} />
  }
  if (content.startsWith('[IMG_MSG]:')) {
    const data = parseImgTextMessage(content)
    if (!data) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
        <span style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{data.text}</span>
        <ImageMessage url={data.url} />
      </div>
    )
  }
  if (content.startsWith('[STICKER]:')) {
    return <span style={{ fontSize: '56px', lineHeight: 1.1 }}>{content.replace('[STICKER]:', '')}</span>
  }
  if (content.startsWith('[VOICE]:')) {
    return <VoicePlayer url={content.replace('[VOICE]:', '')} isOwn={isOwnerMsg} />
  }
  if (content.startsWith('[BET]:')) {
    const bet = parseBetMessage(content)
    if (bet) return <BetCard bet={bet} timeStr={timeStr} />
    return null
  }
  if (content.startsWith('[GIF]:')) {
    return <ImageMessage url={content.replace('[GIF]:', '')} isGif />
  }
  if (content.startsWith('[IMAGE]:')) {
    return <ImageMessage url={content.replace('[IMAGE]:', '')} />
  }
  if (content.startsWith('[FILE:')) {
    const match = content.match(/\[FILE:(.*?)\]:(.*)/)
    if (match) return (
      <a href={match[2]} target="_blank" rel="noreferrer" style={{ color: linkColor, display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <span>📎</span><span style={{ textDecoration: 'underline', fontSize: '13px' }}>{match[1]}</span>
      </a>
    )
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = content.split(urlRegex)
  if (parts.length > 1) {
    return (
      <span>
        {parts.map((part, i) => {
          if (!/^https?:\/\//.test(part)) return part
          const isCanalLink = part.includes('fyourbet.com/canal/')
          if (isCanalLink) {
            const code = part.split('/canal/')[1]?.split(/[?#\s]/)[0]
            return (
              <span key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInternalLink?.(code) }}
                style={{ color: linkColor, textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all', userSelect: 'none' }}>
                📡 {part}
              </span>
            )
          }
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer"
              style={{ color: linkColor, textDecoration: 'underline', wordBreak: 'break-all' }}>
              {part}
            </a>
          )
        })}
      </span>
    )
  }
  if (isSingleEmoji(content)) {
    return (
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        style={{ fontSize: '52px', lineHeight: 1.1, display: 'inline-block' }}
      >
        {content.trim()}
      </motion.span>
    )
  }
  return content
}

export function isImageMessage(content) { return content?.startsWith('[IMAGE]:') }
export function isBetMessage(content) { return content?.startsWith('[BET]:') }
export function isStickerMessage(content) { return content?.startsWith('[STICKER]:') }
export function isVoiceMessage(content) { return content?.startsWith('[VOICE]:') }
export function isProfileMessage(content) { return content?.startsWith('[PROFILE]:') }
export function isPollMessage(content) { return content?.startsWith('[POLL]:') }
export function parsePollMessage(content) {
  try { return JSON.parse(content.replace('[POLL]:', '')) } catch { return null }
}
export function isImgTextMessage(content) { return content?.startsWith('[IMG_MSG]:') }
export function parseImgTextMessage(content) {
  try { return JSON.parse(content.replace('[IMG_MSG]:', '')) } catch { return null }
}

// Detecta missatges reenviats: [FWD:NomCanal]:contingut o [FWD]:contingut
export function parseForward(content) {
  if (!content?.startsWith('[FWD')) return { forwardedFrom: null, inner: content }
  if (content.startsWith('[FWD]:')) return { forwardedFrom: 'dm', inner: content.slice(6) }
  const m = content.match(/^\[FWD:([^\]]*)\]:(.*)$/s)
  if (m) return { forwardedFrom: m[1], inner: m[2] }
  return { forwardedFrom: null, inner: content }
}

// Detecta respostes: [REPLY:msgId|previewText]:contingut (o llegat sense ID)
export function parseReply(content) {
  if (!content?.startsWith('[REPLY:')) return { replyId: null, replyPreview: null, inner: content }
  const m = content.match(/^\[REPLY:([^\]]*)\]:(.*)$/s)
  if (!m) return { replyId: null, replyPreview: null, inner: content }
  const meta = m[1]
  const pipeIdx = meta.indexOf('|')
  if (pipeIdx >= 0) return { replyId: meta.slice(0, pipeIdx), replyPreview: meta.slice(pipeIdx + 1), inner: m[2] }
  return { replyId: null, replyPreview: meta, inner: m[2] }
}

// Llegeix pinned_message (JSON {"c":raw,"e":expiryMs|null}) o string pla (llegat)
export function parsePinnedValue(val) {
  if (!val) return null
  try {
    const obj = JSON.parse(val)
    if (obj.e && Date.now() > obj.e) return null
    return { rawContent: obj.c, expiresAt: obj.e || null }
  } catch {
    return { rawContent: val, expiresAt: null }
  }
}

// Detecta missatges editats (sufixe [EDITED])
export function parseEdited(content) {
  if (content?.endsWith('[EDITED]')) return { edited: true, content: content.slice(0, -8) }
  return { edited: false, content: content ?? '' }
}

export function formatMsgTime(created_at) {
  if (!created_at) return ''
  const date = new Date(created_at)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function getDayLabel(created_at) {
  if (!created_at) return null
  const date = new Date(created_at)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - msgDay) / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DaySeparator({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)',
        background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-full)', padding: '3px 12px',
      }}>
        {label}
      </span>
    </div>
  )
}
