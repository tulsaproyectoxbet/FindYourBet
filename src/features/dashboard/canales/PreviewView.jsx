import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../../components/ui/Button'
import { useMessages } from './hooks/useMessages'

function renderMessage(content) {
  if (content.startsWith('[IMAGE]:')) {
    const url = content.replace('[IMAGE]:', '')
    return <img src={url} alt="img" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)', display: 'block' }} />
  }
  if (content.startsWith('[FILE:')) {
    const match = content.match(/\[FILE:(.*?)\]:(.*)/)
    if (match) return (
      <a href={match[2]} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <span>📎</span><span style={{ textDecoration: 'underline', fontSize: '13px' }}>{match[1]}</span>
      </a>
    )
  }
  return content
}

export default function PreviewView({ channel, user, onBack, onJoin, joining, memberCount }) {
  const { messages, loading } = useMessages(channel.id)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>#{channel.name}</div>
          {channel.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{channel.description}</div>}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>👥 {memberCount} participantes</span>
        <span style={{ fontSize: '11px', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-border)', fontWeight: 600 }}>
          Vista previa
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Sin mensajes todavía en este canal.</div>
          </div>
        ) : (
          <>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                <div style={{ background: 'var(--color-bg-soft)', color: 'var(--color-text)', padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: '14px', lineHeight: 1.5, border: '0.5px solid var(--color-border)' }}>
                  {renderMessage(m.content)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div style={{ position: 'sticky', bottom: 0, height: '80px', background: 'linear-gradient(to bottom, transparent, var(--color-bg))', pointerEvents: 'none', marginTop: '-80px' }} />
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)' }}>
        <div style={{ fontSize: '14px', color: 'var(--color-text-soft)', textAlign: 'center' }}>
          Únete al canal para ver todos los mensajes e interactuar con la comunidad
        </div>
        <Button onClick={onJoin} disabled={joining}>
          {joining ? 'Uniéndose...' : `Unirse a #${channel.name}`}
        </Button>
      </div>
    </motion.div>
  )
}