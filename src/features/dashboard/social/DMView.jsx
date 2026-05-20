import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { StickerPicker } from '../StickerPicker'
import { VoicePlayer, VoiceRecordButton } from '../VoiceMessage'
import { usePolling } from '../../../hooks/usePolling'
import ForwardModal from './ForwardModal'
import PinDurationModal from '../canales/PinDurationModal'

function getDayLabel(ts) {
  if (!ts) return null
  const date = new Date(ts)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((today - msgDay) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function parseForward(content) {
  if (!content?.startsWith('[FWD')) return { forwardedFrom: null, inner: content }
  if (content.startsWith('[FWD]:')) return { forwardedFrom: 'dm', inner: content.slice(6) }
  const m = content.match(/^\[FWD:([^\]]*)\]:(.*)$/s)
  if (m) return { forwardedFrom: m[1], inner: m[2] }
  return { forwardedFrom: null, inner: content }
}

function parseReply(content) {
  if (!content?.startsWith('[REPLY:')) return { replyId: null, replyPreview: null, inner: content }
  const m = content.match(/^\[REPLY:([^\]]*)\]:(.*)$/s)
  if (!m) return { replyId: null, replyPreview: null, inner: content }
  const meta = m[1]
  const pipeIdx = meta.indexOf('|')
  if (pipeIdx >= 0) return { replyId: meta.slice(0, pipeIdx), replyPreview: meta.slice(pipeIdx + 1), inner: m[2] }
  return { replyId: null, replyPreview: meta, inner: m[2] }
}

function parseEdited(content) {
  if (content?.endsWith('[EDITED]')) return { edited: true, content: content.slice(0, -8) }
  return { edited: false, content: content ?? '' }
}

function parsePinnedValue(val) {
  if (!val) return null
  try {
    const obj = JSON.parse(val)
    if (obj.e && Date.now() > obj.e) return null
    return { rawContent: obj.c, expiresAt: obj.e || null }
  } catch {
    return { rawContent: val, expiresAt: null }
  }
}

function isSingleEmoji(content) {
  const t = content.trim()
  if (!t || t.startsWith('[')) return false
  try {
    const segs = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)]
    return segs.length === 1 && /\p{Emoji}/u.test(t)
  } catch {
    return /^\p{Emoji_Presentation}️?$/u.test(t)
  }
}

function renderContent(content, isOwn, onViewProfile) {
  if (!content) return null
  if (content.startsWith('[PROFILE]:')) {
    const rest = content.replace('[PROFILE]:', '')
    const idx = rest.indexOf(':')
    const profileId = idx >= 0 ? rest.slice(0, idx) : rest
    const profileUsername = idx >= 0 ? rest.slice(idx + 1) : '?'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', minWidth: '200px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
          {(profileUsername || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>@{profileUsername}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tipster · FYB</div>
        </div>
        <button onClick={() => onViewProfile?.(profileId)}
          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          Ver →
        </button>
      </div>
    )
  }
  if (content.startsWith('[STICKER]:')) {
    return <span style={{ fontSize: '56px', lineHeight: 1.1 }}>{content.replace('[STICKER]:', '')}</span>
  }
  if (content.startsWith('[VOICE]:')) {
    const url = content.replace('[VOICE]:', '')
    return <VoicePlayer url={url} isOwn={isOwn} />
  }
  if (content.startsWith('[GIF]:')) {
    const url = content.replace('[GIF]:', '')
    return <img src={url} alt="gif" style={{ display: 'block', maxWidth: '240px', maxHeight: '200px', borderRadius: 'var(--radius-md)', objectFit: 'contain' }} />
  }
  if (content.startsWith('[IMAGE]:')) {
    const url = content.replace('[IMAGE]:', '')
    return <img src={url} alt="img" style={{ display: 'block', minWidth: '160px', minHeight: '120px', maxWidth: '100%', maxHeight: '340px', borderRadius: 'var(--radius-md)' }} />
  }
  if (content.startsWith('[FILE:')) {
    const match = content.match(/\[FILE:(.*?)\]:(.*)/)
    if (match) return (
      <a href={match[2]} target="_blank" rel="noreferrer"
        style={{ color: isOwn ? '#010906' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <span>📎</span><span style={{ textDecoration: 'underline', fontSize: '13px' }}>{match[1]}</span>
      </a>
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

export default function DMView({ conversation, currentUser, onBack, onSend, onFetchMessages, onBlock, onReport, onViewProfile, onAccept }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [muted, setMuted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [msgMenu, setMsgMenu] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [editedMap, setEditedMap] = useState({})
  const [pinnedMsg, setPinnedMsg] = useState(() => parsePinnedValue(conversation.pinned_message))
  const [pinDurationFor, setPinDurationFor] = useState(null)
  const [highlightedMsgId, setHighlightedMsgId] = useState(null)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(0)
  const wasAtBottomRef = useRef(true)
  const fileInputRef = useRef(null)

  // Sincronitza pinned_message des de la BD en obrir la conversa
  useEffect(() => {
    supabase.from('dm_conversations').select('pinned_message').eq('id', conversation.id).single()
      .then(({ data }) => { if (data) setPinnedMsg(parsePinnedValue(data.pinned_message)) })
  }, [conversation.id])

  const isNearBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const loadMessages = useCallback(async () => {
    const data = await onFetchMessages(conversation.id)
    setMessages(data)
    setLoading(false)
  }, [conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    loadMessages()
  }, [conversation.id, loadMessages])

  usePolling(loadMessages, 5000, !!conversation.id)

  useEffect(() => {
    const newCount = messages.length
    const prevCount = prevCountRef.current
    if (newCount > prevCount && (wasAtBottomRef.current || prevCount === 0)) {
      bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' })
    }
    prevCountRef.current = newCount
  }, [messages])

  const refreshMessages = async () => {
    const data = await onFetchMessages(conversation.id)
    setMessages(data)
  }

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`dm-msg-${msgId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMsgId(msgId)
    setTimeout(() => setHighlightedMsgId(null), 2200)
  }

  const handleDeleteMsg = async (msgId) => {
    await supabase.from('direct_messages').update({ content: '[DELETED]' }).eq('id', msgId)
    setEditedMap(prev => ({ ...prev, [msgId]: '[DELETED]' }))
    setMsgMenu(null)
  }

  const handlePin = async (rawContent, durationMs) => {
    if (pinnedMsg?.rawContent === rawContent) {
      await supabase.from('dm_conversations').update({ pinned_message: null }).eq('id', conversation.id)
      setPinnedMsg(null)
      setMsgMenu(null)
      return
    }
    const e = durationMs ? Date.now() + durationMs : null
    const val = JSON.stringify({ c: rawContent, e })
    await supabase.from('dm_conversations').update({ pinned_message: val }).eq('id', conversation.id)
    setPinnedMsg({ rawContent, expiresAt: e })
    setPinDurationFor(null)
  }

  const handleSend = async () => {
    if (!text.trim()) return
    if (editingMsg) {
      const saved = text + '[EDITED]'
      await supabase.from('direct_messages').update({ content: saved }).eq('id', editingMsg.id)
      setEditedMap(prev => ({ ...prev, [editingMsg.id]: saved }))
      setEditingMsg(null)
      setText('')
      return
    }
    let content = text
    if (replyTo) content = `[REPLY:${replyTo.id}|${replyTo.preview}]:${content}`
    setText('')
    setReplyTo(null)
    await onSend(conversation.id, content)
    await refreshMessages()
  }

  const handleSendSticker = (sticker) => {
    setText(prev => prev + sticker)
  }

  const handleSendGif = async (url) => {
    await onSend(conversation.id, `[GIF]:${url}`)
    await refreshMessages()
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') { setReplyTo(null); setEditingMsg(null); setText(''); return }
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (e.ctrlKey) { setText(prev => prev + '\n') } else { handleSend() }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `dm/${currentUser.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('channel-files').upload(path, file, { upsert: true })
      if (error) { setUploadError(`Error al subir: ${error.message}`); return }
      const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
      const isImage = /^image\/(jpeg|png|gif|webp)$/.test(file.type) || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
      const content = isImage ? `[IMAGE]:${urlData.publicUrl}` : `[FILE:${file.name}]:${urlData.publicUrl}`
      await onSend(conversation.id, content)
      await refreshMessages()
    } catch {
      setUploadError('Error inesperado al subir el archivo.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const menuItems = [
    { icon: muted ? '🔔' : '🔕', label: muted ? 'Activar notificaciones' : 'Silenciar', action: () => { setMuted(!muted); setShowMenu(false) } },
    { icon: '🚩', label: 'Reportar', action: () => { onReport?.(conversation.id); setShowMenu(false) } },
    { icon: '🚫', label: 'Bloquear', action: () => { onBlock?.(conversation.id); setShowMenu(false) }, danger: true },
  ]

  const isPending = !conversation.otherAccepted && conversation.user1_id === currentUser.id
  const ownSentCount = messages.filter(m => m.sender_id === currentUser.id).length
  const otherSentCount = messages.filter(m => m.sender_id !== currentUser.id).length
  const pendingLocked = isPending && ownSentCount >= 2
  const needsAccept = !conversation.isAccepted && conversation.user1_id !== currentUser.id && otherSentCount > 0

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', position: 'relative' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div onClick={() => onViewProfile?.(conversation.otherId)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
            {conversation.otherAvatarUrl
              ? <img src={conversation.otherAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (conversation.otherUsername || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{conversation.otherUsername}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(!showMenu)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px' }}>
            ⋮
          </button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{ position: 'absolute', top: '36px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '180px', overflow: 'hidden' }}>
                {menuItems.map((item, i) => (
                  <button key={i} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: item.danger ? 'var(--color-error)' : 'var(--color-text)', textAlign: 'left', borderBottom: i < menuItems.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Missatge fixat */}
      {pinnedMsg && (() => {
        const { inner: pNoFwd } = parseForward(pinnedMsg.rawContent)
        const { inner: pNoReply } = parseReply(pNoFwd)
        const { content: pDisplay } = parseEdited(pNoReply)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📌</span>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>{pDisplay}</div>
            <button onClick={() => handlePin(pinnedMsg.rawContent, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0, padding: '0 4px' }}>✕</button>
          </div>
        )
      })()}

      {/* MISSATGES */}
      <div ref={scrollRef} onScroll={() => { wasAtBottomRef.current = isNearBottom() }}
        style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Empieza la conversación</div>
          </div>
        ) : messages.map((m, i) => {
          const rawContent = editedMap[m.id] ?? m.content
          const isDeletedMsg = rawContent === '[DELETED]'
          const { forwardedFrom, inner: noFwd } = parseForward(rawContent)
          const { replyId, replyPreview, inner: noReply } = parseReply(noFwd)
          const { edited, content: displayContent } = parseEdited(noReply)
          const isOwn = m.sender_id === currentUser.id
          const isImage = displayContent?.startsWith('[IMAGE]:')
          const isSticker = displayContent?.startsWith('[STICKER]:')
          const isProfile = displayContent?.startsWith('[PROFILE]:')
          const isVoice = displayContent?.startsWith('[VOICE]:')
          const isSpecialNobubble = isSticker || isProfile
          const prev = messages[i - 1]
          const dayLabel = getDayLabel(m.created_at)
          const showDaySep = !prev || getDayLabel(prev.created_at) !== dayLabel
          const isHovered = hoveredMsgId === m.id
          const isMenuOpen = msgMenu?.id === m.id
          const isHighlighted = highlightedMsgId === m.id
          return (
            <div key={m.id} id={`dm-msg-${m.id}`}
              onMouseEnter={() => setHoveredMsgId(m.id)}
              onMouseLeave={() => { if (!isMenuOpen) setHoveredMsgId(null) }}
              style={{ borderRadius: 'var(--radius-md)', padding: '1px 2px', margin: '-1px -2px', transition: 'background 0.4s', background: isHighlighted ? 'rgba(15,110,86,0.13)' : 'transparent' }}>
              {showDaySep && dayLabel && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: '999px', padding: '3px 12px' }}>
                    {dayLabel}
                  </span>
                </div>
              )}
              {isDeletedMsg ? (
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', margin: '2px 0' }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '7px 12px' }}>
                    🚫 Mensaje eliminado
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                  <div style={{ maxWidth: isProfile ? '320px' : isSticker ? 'fit-content' : isVoice ? '280px' : '70%' }}>
                    {forwardedFrom && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>↩</span>
                        <span>{forwardedFrom === 'dm' ? 'Reenviado' : `Reenviado de ${forwardedFrom}`}</span>
                      </div>
                    )}
                    <div style={{
                      position: 'relative',
                      background: isSpecialNobubble ? 'transparent' : isOwn ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                      color: isOwn ? '#010906' : 'var(--color-text)',
                      padding: isImage ? '6px' : isSpecialNobubble ? '0' : isVoice ? '10px 12px 22px 12px' : '7px 12px 19px 12px',
                      borderRadius: isSpecialNobubble || isImage ? 'var(--radius-lg)' : isOwn ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      minWidth: !isSpecialNobubble && !isImage && !isVoice ? '56px' : undefined,
                      fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', textAlign: 'left',
                      border: isOwn || isSpecialNobubble ? 'none' : '0.5px solid var(--color-border)'
                    }}>
                      {/* ▾ inside bubble — opacity only, no layout shift */}
                      {!isSpecialNobubble && (
                        <button
                          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                          style={{ position: 'absolute', top: '4px', right: '4px', opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: isOwn ? 'rgba(1,9,6,0.15)' : 'rgba(0,0,0,0.08)', border: 'none', borderRadius: 'var(--radius-full)', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                          ▾
                        </button>
                      )}
                      {replyPreview && (
                        <div onClick={() => replyId && scrollToMessage(replyId)}
                          style={{ background: isOwn ? 'rgba(1,9,6,0.12)' : 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isOwn ? 'rgba(1,9,6,0.35)' : 'var(--color-primary)'}`, borderRadius: '4px', padding: '5px 8px', marginBottom: '8px', fontSize: '12px', opacity: 0.85, overflow: 'hidden', maxHeight: '52px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: replyId ? 'pointer' : 'default' }}>
                          {replyPreview}
                        </div>
                      )}
                      {renderContent(displayContent, isOwn, onViewProfile)}
                      {edited && !isSpecialNobubble && !isImage && (
                        <span style={{ fontSize: '10px', opacity: 0.55, fontStyle: 'italic', marginLeft: '4px' }}>(editado)</span>
                      )}
                      {!isImage && !isSpecialNobubble && (
                        <span style={{ position: 'absolute', bottom: '5px', right: '10px', fontSize: '10px', fontWeight: 500, color: isOwn ? 'rgba(1,9,6,0.65)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatTime(m.created_at)}{isOwn && m.read_at ? ' ✓✓' : ''}
                        </span>
                      )}
                    </div>
                    {(isImage || isSpecialNobubble) && (
                      <>
                        <button
                          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                          style={{ display: 'flex', opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', alignItems: 'center', justifyContent: 'center' }}>
                          ▾
                        </button>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', textAlign: isOwn ? 'right' : 'left' }}>
                          {formatTime(m.created_at)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* BANNER PENDENT */}
      {pendingLocked && (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }}>
          ⏳ Esperando que @{conversation.otherUsername} acepte la conversación
        </div>
      )}

      {/* BANNER ACCEPTAR */}
      {needsAccept && (
        <div style={{ marginTop: '12px', padding: '16px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            @{conversation.otherUsername} quiere enviarte un mensaje
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={() => onBlock?.(conversation.id)}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              Rechazar
            </button>
            <button onClick={() => onAccept?.(conversation.id)}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Menú contextual */}
      <AnimatePresence>
        {msgMenu && (() => {
          const msg = messages.find(m => m.id === msgMenu.id)
          if (!msg) return null
          const rawContent = editedMap[msg.id] ?? msg.content
          const { inner: noFwd } = parseForward(rawContent)
          const { inner: noReply } = parseReply(noFwd)
          const { content: displayContent } = parseEdited(noReply)
          const isOwnMsg = msg.sender_id === currentUser.id
          const isImgMsg = displayContent?.startsWith('[IMAGE]:')
          const isStkMsg = displayContent?.startsWith('[STICKER]:')
          const isVoiceMsg = displayContent?.startsWith('[VOICE]:')
          const isProfMsg = displayContent?.startsWith('[PROFILE]:')
          const canEdit = isOwnMsg && !isImgMsg && !isStkMsg && !isVoiceMsg && !isProfMsg

          const items = [
            { icon: '📋', label: 'Copiar', action: () => { navigator.clipboard.writeText(displayContent); setMsgMenu(null) } },
            { icon: '↩', label: 'Responder', action: () => { setReplyTo({ id: msg.id, preview: displayContent.slice(0, 80) }); setMsgMenu(null) } },
            { icon: '↗️', label: 'Reenviar', action: () => { setForwardMsg({ content: displayContent }); setMsgMenu(null) } },
            { icon: '📌', label: pinnedMsg?.rawContent === rawContent ? 'Desfijar' : 'Fijar', action: () => { if (pinnedMsg?.rawContent === rawContent) { handlePin(rawContent, null) } else { setPinDurationFor(rawContent); setMsgMenu(null) } } },
            canEdit && { icon: '✏️', label: 'Editar', action: () => { setEditingMsg({ id: msg.id }); setText(displayContent); setMsgMenu(null) } },
            isOwnMsg && { icon: '🗑', label: 'Eliminar', action: () => handleDeleteMsg(msg.id), danger: true },
          ].filter(Boolean)

          const menuH = items.length * 44
          const showAbove = msgMenu.y + menuH > window.innerHeight - 20
          const posStyle = showAbove ? { bottom: window.innerHeight - msgMenu.y + 4 } : { top: msgMenu.y + 4 }
          const leftPos = Math.min(msgMenu.x, window.innerWidth - 190)
          return (
            <>
              <div onClick={() => setMsgMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
              <motion.div key="ctxdm"
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
                style={{ position: 'fixed', left: leftPos, ...posStyle, zIndex: 150, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: '175px' }}>
                {items.map((item, idx) => (
                  <button key={idx} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: idx < items.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: item.danger ? 'var(--color-error)' : 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>

      {/* Forward modal */}
      <AnimatePresence>
        {forwardMsg && (
          <ForwardModal
            content={forwardMsg.content}
            fromChannelName={null}
            currentUser={currentUser}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Pin duration modal */}
      <AnimatePresence>
        {pinDurationFor && (
          <PinDurationModal
            onSelect={(ms) => handlePin(pinDurationFor, ms)}
            onClose={() => setPinDurationFor(null)}
          />
        )}
      </AnimatePresence>

      {/* INPUT */}
      {!needsAccept && !pendingLocked && (
        <div style={{ marginTop: '12px' }}>
          {isPending && (
            <div style={{ marginBottom: '8px', padding: '8px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span>
              <span>Puedes enviar {2 - ownSentCount} mensaje{2 - ownSentCount !== 1 ? 's' : ''} más antes de que @{conversation.otherUsername} acepte la conversación.</span>
            </div>
          )}
          {uploadError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-error)' }}>
              {uploadError}
            </div>
          )}
          {(replyTo || editingMsg) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${editingMsg ? 'var(--color-warning)' : 'var(--color-primary)'}`, paddingLeft: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: editingMsg ? 'var(--color-warning)' : 'var(--color-primary)', marginBottom: '1px' }}>{editingMsg ? '✏️ Editando' : '↩ Respondiendo'}</div>
                {replyTo && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.preview}</div>}
              </div>
              <button onClick={() => { setReplyTo(null); setEditingMsg(null); setText('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>✕</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {uploading ? '⏳' : '📎'}
            </button>
            <VoiceRecordButton userId={currentUser.id} onSend={async content => { await onSend(conversation.id, content); await refreshMessages() }} />
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
              placeholder="Envía un mensaje" rows={2}
              style={{ flex: 1, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowStickers(v => !v)}
                style={{ background: showStickers ? 'var(--color-primary-light)' : 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: showStickers ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                😊
              </button>
              <AnimatePresence>
                {showStickers && <StickerPicker onSelect={handleSendSticker} onSendGif={handleSendGif} onClose={() => setShowStickers(false)} user={currentUser} />}
              </AnimatePresence>
            </div>
            <button onClick={handleSend} disabled={!text.trim()}
              style={{ background: text.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: text.trim() ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '12px 18px', borderRadius: 'var(--radius-md)', cursor: text.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
