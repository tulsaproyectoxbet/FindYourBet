import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function renderContent(content, isOwn) {
  if (!content) return null
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
  return content
}

export default function DMView({ conversation, currentUser, onBack, onSend, onFetchMessages, onBlock, onReport, onMute }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [muted, setMuted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(0)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [conversation.id])

  const loadMessages = async () => {
    const data = await onFetchMessages(conversation.id)
    setMessages(data)
    const newCount = data.length
    const prevCount = prevCountRef.current
    if (newCount > prevCount || prevCount === 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' }), 50)
    }
    prevCountRef.current = newCount
    setLoading(false)
  }

  const handleSend = async () => {
    if (!text.trim()) return
    const content = text
    setText('')
    await onSend(conversation.id, content)
    await loadMessages()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
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
      await loadMessages()
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
  const needsAccept = !conversation.isAccepted && conversation.user1_id !== currentUser.id

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', position: 'relative' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ width: '36px', height: '36px', background: 'var(--color-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
          {(conversation.otherUsername || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>@{conversation.otherUsername}</div>
          {conversation.otherName && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{conversation.otherName}</div>}
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

      {/* MISSATGES */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Empieza la conversación</div>
          </div>
        ) : messages.map(m => {
          const isOwn = m.sender_id === currentUser.id
          const isImage = m.content?.startsWith('[IMAGE]:')
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  position: 'relative',
                  background: isOwn ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                  color: isOwn ? '#010906' : 'var(--color-text)',
                  padding: isImage ? '6px' : '10px 14px 22px 14px',
                  borderRadius: 'var(--radius-lg)', fontSize: '14px', lineHeight: 1.5,
                  border: isOwn ? 'none' : '0.5px solid var(--color-border)'
                }}>
                  {renderContent(m.content, isOwn)}
                  {!isImage && (
                    <span style={{
                      position: 'absolute', bottom: '5px', right: '10px',
                      fontSize: '10px',
                      color: isOwn ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatTime(m.created_at)}{isOwn && m.read_at ? ' ✓✓' : ''}
                    </span>
                  )}
                </div>
                {isImage && (
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', textAlign: isOwn ? 'right' : 'left' }}>
                    {formatTime(m.created_at)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* BANNER PENDENT */}
      {isPending && (
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
            <button onClick={() => {}}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* INPUT */}
      {!needsAccept && !isPending && (
        <div style={{ marginTop: '12px' }}>
          {uploadError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-error)' }}>
              {uploadError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {uploading ? '⏳' : '📎'}
            </button>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
              placeholder="Escribe un mensaje... (Enter para enviar)" rows={2}
              style={{ flex: 1, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
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
