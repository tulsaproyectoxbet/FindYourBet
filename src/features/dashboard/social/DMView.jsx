import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { StickerPicker } from '../StickerPicker'
import { VoicePlayer, VoiceRecordButton } from '../VoiceMessage'
import Username from '../../../components/ui/Username'
import { usePolling } from '../../../hooks/usePolling'
import { MUTE_DURATIONS } from '../../../hooks/useMutes'
import { useProfileNav } from '../../../contexts/ProfileNavContext'
import { useMentionInput } from '../../../hooks/useMentionInput'
import { clampLines, LINE_LIMIT } from '../../../lib/textLimits'
import MentionText from '../../../components/ui/MentionText'
import ForwardModal from './ForwardModal'
import ForwardedChannelModal from '../canales/ForwardedChannelModal'
import PinDurationModal from '../canales/PinDurationModal'
import { ImageMessage } from '../canales/messageRenderer'

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

function renderContent(content, isOwn, onViewProfile, onMention) {
  if (!content) return null
  if (content.startsWith('[IMG_MSG]:')) {
    try {
      const { url, text } = JSON.parse(content.replace('[IMG_MSG]:', ''))
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
          <span style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</span>
          <ImageMessage url={url} />
        </div>
      )
    } catch { return null }
  }
  if (content.startsWith('[CHANNEL]:')) {
    const rest = content.replace('[CHANNEL]:', '')
    const idx = rest.indexOf(':')
    const code = idx >= 0 ? rest.slice(0, idx) : rest
    const name = idx >= 0 ? rest.slice(idx + 1) : '?'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', minWidth: '200px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
          📢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Canal compartido</div>
        </div>
        <button onClick={() => onNavigateToChannel?.({ invite_code: code })}
          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '5px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          Ver →
        </button>
      </div>
    )
  }
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
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{profileUsername}</div>
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
    return <ImageMessage url={content.replace('[GIF]:', '')} isGif />
  }
  if (content.startsWith('[IMAGE]:')) {
    return <ImageMessage url={content.replace('[IMAGE]:', '')} />
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
  return <MentionText text={content} onMention={onMention} color={isOwn ? '#010906' : 'var(--color-primary)'} />
}

// Divisor "Nuevos mensajes" per als DMs (id fix per fer-hi scroll directe).
function NewMessagesDivider() {
  return (
    <div id="dm-nuevos-divider" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0', opacity: 0.75 }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-primary)' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>Nuevos mensajes</span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-primary)' }} />
    </div>
  )
}

export default function DMView({ conversation, currentUser, onBack, onSend, onFetchMessages, onMarkRead, onUnreadChange, onBlock, onReport, onViewProfile, onAccept, onNavigateToChannel, isPinned, onTogglePin, isMutedConv, onMuteConv, onUnmuteConv, onDeleteConv, compact = false }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const msgInputRef = useRef(null)
  const mention = useMentionInput({ currentUser, text, setText, inputRef: msgInputRef })
  // Clic en una menció @usuario → obre el perfil emergent (modal global), igual a tot arreu.
  const openProfileGlobal = useProfileNav()
  const handleMention = async (username) => {
    const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (data?.id) openProfileGlobal(data.id)
  }
  // Tracking de no llegits per scroll (mateix model que ChatView):
  const [firstUnreadId, setFirstUnreadId] = useState(null) // snapshot per al divisor
  const [markedIds, setMarkedIds] = useState(() => new Set()) // missatges marcats aquesta sessió
  const firstUnreadDoneRef = useRef(false)
  const markedRef = useRef(new Set())
  const observerRef = useRef(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showMuteSub, setShowMuteSub] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [pastedImage, setPastedImage] = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [fwdChannel, setFwdChannel] = useState(null)
  const [msgMenu, setMsgMenu] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [editedMap, setEditedMap] = useState({})
  const [pinnedMsg, setPinnedMsg] = useState(() => parsePinnedValue(conversation.pinned_message))
  const [pinDurationFor, setPinDurationFor] = useState(null)
  const [highlightedMsgId, setHighlightedMsgId] = useState(null)
  const [blockedStatus, setBlockedStatus] = useState(null) // null | 'blocked_by_me' | 'blocked_by_them'
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(0)
  const wasAtBottomRef = useRef(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!conversation.otherId || !currentUser?.id) return
    Promise.all([
      supabase.from('blocks').select('id').eq('blocker_id', currentUser.id).eq('blocked_id', conversation.otherId).maybeSingle(),
      supabase.from('blocks').select('id').eq('blocker_id', conversation.otherId).eq('blocked_id', currentUser.id).maybeSingle(),
    ]).then(([{ data: iBlocked }, { data: theyBlocked }]) => {
      if (iBlocked) setBlockedStatus('blocked_by_me')
      else if (theyBlocked) setBlockedStatus('blocked_by_them')
      else setBlockedStatus(null)
    })
  }, [conversation.otherId, currentUser?.id])

  const handleUnblockFromDM = async () => {
    await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', conversation.otherId)
    setBlockedStatus(null)
  }

  const isNearBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const loadMessages = useCallback(async () => {
    // Safety timer + try/catch/finally (regla 3 CLAUDE.md): si la petició fa timeout,
    // el spinner "Cargando mensajes" no pot quedar penjat per sempre.
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      const [data, { data: convData }] = await Promise.all([
        onFetchMessages(conversation.id),
        supabase.from('dm_conversations').select('pinned_message').eq('id', conversation.id).single()
      ])
      // Només sobreescrivim si tenim un array vàlid — així un error transitori
      // no buida la conversa (es recupera al pròxim poll).
      if (Array.isArray(data)) setMessages(data)
      if (convData !== undefined) setPinnedMsg(parsePinnedValue(convData?.pinned_message))
    } catch {
      // Empassat: el finally apaga el loading.
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }, [conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    loadMessages()
  }, [conversation.id, loadMessages])

  // Realtime: sense filter (els filters d'UPDATE requereixen REPLICA IDENTITY FULL)
  // Filtrem al callback per conversation_id / per id de missatge a l'estat
  useEffect(() => {
    if (!conversation.id) return
    const channel = supabase.channel(`dm-view-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
      }, (payload) => {
        if (payload.new.conversation_id === conversation.id) loadMessages()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'direct_messages',
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [conversation.id, loadMessages])

  // Polling de fallback si Realtime es desconnecta
  usePolling(loadMessages, 30000, !!conversation.id)

  // Snapshot del primer no llegit (sender != jo, read_at null) en el primer load.
  // Congelat: fixa on va el divisor "Nuevos mensajes" tota la sessió.
  useEffect(() => {
    if (firstUnreadDoneRef.current || messages.length === 0) return
    firstUnreadDoneRef.current = true
    const fu = messages.find(m => m.sender_id !== currentUser.id && !m.read_at)
    setFirstUnreadId(fu?.id || null)
  }, [messages, currentUser.id])

  useEffect(() => {
    const newCount = messages.length
    const prevCount = prevCountRef.current
    if (newCount > prevCount) {
      if (prevCount === 0) {
        // Primer load: posiciona't al divisor de nous missatges; si no n'hi ha, al final.
        const fu = messages.find(m => m.sender_id !== currentUser.id && !m.read_at)
        if (fu) {
          requestAnimationFrame(() => {
            const el = document.getElementById('dm-nuevos-divider') || document.getElementById(`dm-msg-${fu.id}`)
            el?.scrollIntoView({ behavior: 'instant', block: 'start' })
          })
        } else {
          bottomRef.current?.scrollIntoView({ behavior: 'instant' })
        }
      } else if (wasAtBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevCountRef.current = newCount
  }, [messages, currentUser.id])

  // IntersectionObserver: marca com llegits NOMÉS els missatges d'altri que entren
  // a pantalla (i baixa el comptador). No re-marca els ja marcats (markedRef).
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver((entries) => {
      const newlyRead = []
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.dataset.dmid
          if (id && entry.target.dataset.unread === '1' && !markedRef.current.has(id)) {
            markedRef.current.add(id)
            newlyRead.push(id)
          }
        }
      })
      if (newlyRead.length) {
        setMarkedIds(prev => { const n = new Set(prev); newlyRead.forEach(x => n.add(x)); return n })
        onMarkRead?.(conversation.id, newlyRead)
      }
    }, { root: container, threshold: 0.1 })
    container.querySelectorAll('[data-dmid]').forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [messages, conversation.id, onMarkRead])

  // No llegits restants → reporta al pare per al badge de la sidebar en viu.
  const liveUnread = useMemo(
    () => messages.filter(m => m.sender_id !== currentUser.id && !m.read_at && !markedIds.has(m.id)).length,
    [messages, markedIds, currentUser.id]
  )
  useEffect(() => {
    onUnreadChange?.(conversation.id, liveUnread)
  }, [liveUnread, conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setMsgMenu(null)
    // .select() retorna les files modificades; si està buit, RLS està bloquejant la UPDATE
    const { data, error } = await supabase
      .from('direct_messages')
      .update({ content: '[DELETED]' })
      .eq('id', msgId)
      .select()
    if (error) { console.error('[DM delete] error:', error); alert('Error al eliminar: ' + error.message); return }
    if (!data?.length) {
      console.warn('[DM delete] RLS bloqueja la UPDATE — cap fila modificada')
      alert('No se puede eliminar este mensaje (permisos)')
      return
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: '[DELETED]' } : m))
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

  const uploadToStorage = async (file) => {
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
    const path = `dm/${currentUser.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('channel-files').upload(path, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
    return urlData.publicUrl
  }

  const uploadFile = async (file) => {
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadToStorage(file)
      const isImg = /^image\/(jpeg|png|gif|webp)$/.test(file.type) || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name || '')
      const content = isImg ? `[IMAGE]:${url}` : `[FILE:${file.name}]:${url}`
      await onSend(conversation.id, content)
      await refreshMessages()
    } catch (err) {
      setUploadError(`Error al subir: ${err.message || 'Error inesperado.'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSend = async () => {
    if (!text.trim() && !pastedImage) return
    if (editingMsg) {
      const saved = text + '[EDITED]'
      await supabase.from('direct_messages').update({ content: saved }).eq('id', editingMsg.id)
      setEditedMap(prev => ({ ...prev, [editingMsg.id]: saved }))
      setEditingMsg(null)
      setText('')
      return
    }

    let imageUrl = null
    if (pastedImage) {
      setUploading(true)
      setUploadError('')
      try {
        imageUrl = await uploadToStorage(pastedImage.file)
      } catch (err) {
        setUploadError(`Error al subir: ${err.message || 'Error inesperado.'}`)
        setUploading(false)
        return
      } finally {
        URL.revokeObjectURL(pastedImage.previewUrl)
        setPastedImage(null)
      }
      setUploading(false)
    }

    const trimmedText = text.trim()
    let content
    if (imageUrl && trimmedText) {
      content = `[IMG_MSG]:${JSON.stringify({ url: imageUrl, text: trimmedText })}`
    } else if (imageUrl) {
      content = `[IMAGE]:${imageUrl}`
    } else {
      content = trimmedText
    }

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
    if (mention.handleKeyDown(e)) return // el dropdown de mencions consumeix la tecla
    if (e.key === 'Escape') { setReplyTo(null); setEditingMsg(null); setText(''); return }
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (e.ctrlKey) { setText(prev => prev + '\n') } else { handleSend() }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  const closeMenu = () => { setShowMenu(false); setShowMuteSub(false) }

  // Mateixes accions que el menú de 3 punts de la llista de converses.
  const menuItems = [
    { icon: isPinned ? '📍' : '📌', label: isPinned ? 'Desanclar' : 'Anclar', action: () => { onTogglePin?.(); closeMenu() } },
    {
      icon: isMutedConv ? '🔔' : '🔕', label: isMutedConv ? 'Activar notificaciones' : 'Silenciar',
      // Si està silenciat, reactiva directament; si no, obre el submenú de durades.
      action: () => { if (isMutedConv) { onUnmuteConv?.(); closeMenu() } else { setShowMuteSub(true) } },
    },
    { icon: '🗑️', label: 'Eliminar chat', action: () => { onDeleteConv?.(); closeMenu() }, danger: true },
    { icon: '🚫', label: 'Bloquear', action: () => { onBlock?.(); closeMenu() }, danger: true },
    { icon: '🚩', label: 'Reportar', action: () => { onReport?.(); closeMenu() } },
  ]

  // isPending: sóc jo qui ha escrit primer i encara no m'han acceptat (envio lliurement).
  // needsAccept: algú m'ha escrit i encara no l'he acceptat -> mostro barra Aceptar/Bloquear.
  const isPending = !conversation.otherAccepted && conversation.user1_id === currentUser.id
  const otherSentCount = messages.filter(m => m.sender_id !== currentUser.id).length
  const needsAccept = !conversation.isAccepted && conversation.user1_id !== currentUser.id && otherSentCount > 0

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: compact ? 'calc(100vh - 57px - 48px)' : 'calc(100vh - 160px)', position: 'relative' }}>

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
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              <Username username={conversation.otherUsername} isVerified={conversation.otherIsVerified} size="md" />
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(!showMenu)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px' }}>
            ⋮
          </button>
          {showMenu && (
            <>
              <div onClick={closeMenu} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{ position: 'absolute', top: '36px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '180px', overflow: 'hidden' }}>
                {showMuteSub ? (
                  // Submenú de durades de silenci (igual que a la llista).
                  MUTE_DURATIONS.map((d, i) => (
                    <button key={i} onClick={() => { onMuteConv?.(d.ms); closeMenu() }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text)', textAlign: 'left', borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      {d.label}
                    </button>
                  ))
                ) : (
                  menuItems.map((item, i) => (
                    <button key={i} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: item.danger ? 'var(--color-error)' : 'var(--color-text)', textAlign: 'left', borderBottom: i < menuItems.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))
                )}
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

      {/* BANNER BLOQUEADO POR MÍ */}
      {blockedStatus === 'blocked_by_me' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>🚫</span>
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            Has bloqueado a este usuario. No puedes enviar mensajes.
          </div>
          <button onClick={handleUnblockFromDM}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
            Desbloquear
          </button>
        </div>
      )}

      {/* MISSATGES */}
      <div ref={scrollRef} onScroll={() => { wasAtBottomRef.current = isNearBottom() }}
        style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {blockedStatus === 'blocked_by_them' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            <div style={{ fontSize: '40px' }}>🚫</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>Usuario no encontrado</div>
            <div style={{ fontSize: '13px' }}>No puedes enviar mensajes a este usuario.</div>
          </div>
        ) : loading ? (
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
            <Fragment key={m.id}>
              {m.id === firstUnreadId && <NewMessagesDivider />}
            <div id={`dm-msg-${m.id}`} data-dmid={m.id} data-unread={!isOwn && !m.read_at ? '1' : '0'}
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
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '2px' }}>
                  {/* ⋮ a l'esquerra dels missatges propis */}
                  {isOwn && (
                    <button
                      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                      style={{ opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: 1, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                      ⋮
                    </button>
                  )}
                  <div style={{ maxWidth: isProfile ? '320px' : isSticker ? 'fit-content' : isVoice ? '280px' : '70%' }}>
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
                      {forwardedFrom && !isSpecialNobubble && !isImage && (
                        <div style={{ fontSize: '11px', fontStyle: 'italic', opacity: 0.6, marginBottom: '5px' }}>
                          {forwardedFrom === 'dm'
                            ? 'Reenviado'
                            : <span onClick={() => setFwdChannel(forwardedFrom)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{`Reenviado de: ${forwardedFrom}`}</span>}
                        </div>
                      )}
                      {replyPreview && (
                        <div onClick={() => replyId && scrollToMessage(replyId)}
                          style={{ background: isOwn ? 'rgba(1,9,6,0.12)' : 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isOwn ? 'rgba(1,9,6,0.35)' : 'var(--color-primary)'}`, borderRadius: '4px', padding: '5px 8px', marginBottom: '8px', fontSize: '12px', opacity: 0.85, overflow: 'hidden', maxHeight: '52px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: replyId ? 'pointer' : 'default' }}>
                          {replyPreview}
                        </div>
                      )}
                      {renderContent(displayContent, isOwn, onViewProfile, handleMention)}
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
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', textAlign: isOwn ? 'right' : 'left' }}>
                        {formatTime(m.created_at)}
                      </div>
                    )}
                  </div>
                  {/* ⋮ a la dreta dels missatges dels altres */}
                  {!isOwn && (
                    <button
                      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                      style={{ opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: 1, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                      ⋮
                    </button>
                  )}
                </div>
              )}
            </div>
            </Fragment>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Nota subtil per a l'emissor mentre espera acceptació (input lliure, sense límit) */}
      {isPending && (
        <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          ⏳ Esperando que {conversation.otherUsername} acepte la conversación
        </div>
      )}

      {/* BARRA SOLICITUD — el xat es veu normal; just a sota, Aceptar i Bloquear */}
      {needsAccept && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginRight: 'auto' }}>Solicitud de mensaje</span>
          <button onClick={() => onBlock?.()}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            🚫 Bloquear
          </button>
          <button onClick={() => onAccept?.(conversation.id)}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            ✓ Aceptar
          </button>
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
          const isImgTextMsg = displayContent?.startsWith('[IMG_MSG]:')
          const isStkMsg = displayContent?.startsWith('[STICKER]:')
          const isVoiceMsg = displayContent?.startsWith('[VOICE]:')
          const isProfMsg = displayContent?.startsWith('[PROFILE]:')
          const isBetMsg = displayContent?.startsWith('[BET]:')
          const isPollMsgDM = displayContent?.startsWith('[POLL]:')
          const canEdit = isOwnMsg && !isImgMsg && !isImgTextMsg && !isStkMsg && !isVoiceMsg && !isProfMsg && !isBetMsg && !isPollMsgDM
          const readableDM = isImgTextMsg ? (() => { try { return JSON.parse(displayContent.replace('[IMG_MSG]:', '')).text || '📷 Imagen' } catch { return '📷 Imagen' } })() : (displayContent ?? '')
          const items = [
            { icon: '📋', label: 'Copiar', action: () => { navigator.clipboard.writeText(readableDM); setMsgMenu(null) } },
            { icon: '↩', label: 'Responder', action: () => { setReplyTo({ id: msg.id, preview: readableDM.slice(0, 80) }); setMsgMenu(null) } },
            { icon: '↗️', label: 'Reenviar', action: () => { setForwardMsg({ content: displayContent }); setMsgMenu(null) } },
            { icon: '📌', label: pinnedMsg?.rawContent === rawContent ? 'Desfijar' : 'Fijar', action: () => { if (pinnedMsg?.rawContent === rawContent) { handlePin(rawContent, null) } else { setPinDurationFor(rawContent); setMsgMenu(null) } } },
            canEdit && { icon: '✏️', label: 'Editar', action: () => { setEditingMsg({ id: msg.id }); setText(displayContent); setMsgMenu(null) } },
            isOwnMsg && !isBetMsg && { icon: '🗑', label: 'Eliminar', action: () => handleDeleteMsg(msg.id), danger: true },
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

      <AnimatePresence>
        {fwdChannel && (
          <ForwardedChannelModal
            channelName={fwdChannel}
            currentUser={currentUser}
            onNavigateToChannel={onNavigateToChannel}
            onClose={() => setFwdChannel(null)}
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

      {/* INPUT — sempre disponible (missatgeria lliure); només s'amaga si has bloquejat */}
      {!blockedStatus && (
        <div style={{ marginTop: '12px' }}>
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

          {pastedImage && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '8px' }}>
              <img src={pastedImage.previewUrl} alt="preview"
                style={{ maxHeight: '120px', maxWidth: '220px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-primary-border)', objectFit: 'cover', display: 'block' }} />
              <button onClick={() => { URL.revokeObjectURL(pastedImage.previewUrl); setPastedImage(null) }}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {uploading ? '⏳' : '📎'}
            </button>
            <VoiceRecordButton userId={currentUser.id} onSend={async content => { await onSend(conversation.id, content); await refreshMessages() }} />
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              {mention.dropdown}
              <textarea ref={msgInputRef} value={text} onChange={e => mention.handleChange(clampLines(e.target.value, LINE_LIMIT.MESSAGE), e.target.selectionStart)} onKeyDown={handleKey}
                placeholder="Envía un mensaje" rows={2} maxLength={2000}
                onPaste={e => {
                  const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
                  if (item) {
                    e.preventDefault()
                    const file = item.getAsFile()
                    if (file) setPastedImage({ file, previewUrl: URL.createObjectURL(file) })
                  }
                }}
                style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowStickers(v => !v)}
                style={{ background: showStickers ? 'var(--color-primary-light)' : 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: showStickers ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                😊
              </button>
              <AnimatePresence>
                {showStickers && <StickerPicker onSelect={handleSendSticker} onSendGif={handleSendGif} onClose={() => setShowStickers(false)} user={currentUser} />}
              </AnimatePresence>
            </div>
            <button onClick={handleSend} disabled={!text.trim() && !pastedImage}
              style={{ background: (text.trim() || pastedImage) ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: (text.trim() || pastedImage) ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '12px 18px', borderRadius: 'var(--radius-md)', cursor: (text.trim() || pastedImage) ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
