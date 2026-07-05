import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../../../components/ui/Button'
import AppIcon from '../../../components/ui/AppIcon'
import { useMessages } from './hooks/useMessages'
import {
  renderMessage,
  isBetMessage, isImageMessage, isStickerMessage, isProfileMessage, isVoiceMessage,
  formatMsgTime, getDayLabel, DaySeparator,
} from './messageRenderer'

export default function PreviewView({ channel, user, onBack, onJoin, joining, memberCount, compact = false }) {
  const { messages, loading, recordView } = useMessages(channel.id, user?.id)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const observerRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.dataset.msgid
          if (msgId) recordView(msgId)
        }
      })
    }, { root: container, threshold: 0.1 })
    container.querySelectorAll('[data-msgid]').forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [messages, recordView])

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: compact ? 'calc(100vh - 57px - 48px)' : 'calc(100vh - 160px)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>{channel.name}</div>
          {channel.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{channel.description}</div>}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="users" size={13} /> {memberCount} participantes</span>
        <span style={{ fontSize: '11px', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-border)', fontWeight: 600 }}>
          Vista previa
        </span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AppIcon name="loading" size={14} /> Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ marginBottom: '8px' }}><AppIcon name="message" size={32} /></div>
            <div>Sin mensajes todavía en este canal.</div>
          </div>
        ) : messages.map((m, i) => {
          const isOwn = false // mai propi: usuari encara no és al canal
          const isBet = isBetMessage(m.content)
          const isImage = isImageMessage(m.content)
          const isSticker = isStickerMessage(m.content)
          const isProfile = isProfileMessage(m.content)
          const isVoice = isVoiceMessage(m.content)
          const isNobubble = isSticker || isBet || isProfile
          const timeStr = formatMsgTime(m.created_at)
          const prev = messages[i - 1]
          const showDaySep = !prev || getDayLabel(m.created_at) !== getDayLabel(prev.created_at)
          return (
            <div key={m.id} data-msgid={m.id}>
              {showDaySep && <DaySeparator label={getDayLabel(m.created_at) ?? ''} />}
              <div style={{ display: 'flex', justifyContent: (isBet || isVoice || isProfile) ? 'flex-start' : isOwn ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: isBet || isProfile ? '320px' : isNobubble ? 'fit-content' : isVoice ? '280px' : '70%' }}>
                  <div style={{
                    position: 'relative',
                    background: isNobubble ? 'transparent' : 'var(--color-bg-soft)',
                    color: 'var(--color-text)',
                    padding: isNobubble ? '0' : isImage ? '6px' : isVoice ? '10px 12px 22px 12px' : '7px 12px 19px 12px',
                    borderRadius: isNobubble || isImage ? 'var(--radius-lg)' : '4px 16px 16px 16px',
                    minWidth: !isNobubble && !isImage && !isVoice ? '63px' : undefined,
                    fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', textAlign: 'left',
                    border: isNobubble ? 'none' : '0.5px solid var(--color-border)',
                  }}>
                    {renderMessage(m.content, null, isOwn, null)}
                    {!isNobubble && !isImage && (
                      <span style={{
                        position: 'absolute', bottom: '5px', right: '10px',
                        fontSize: '10px', fontWeight: 500,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}>
                        {m.view_count > 0 ? <><AppIcon name="eye" size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{m.view_count} · </> : ''}{timeStr}
                      </span>
                    )}
                  </div>
                  {(isNobubble || isImage) && (
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', textAlign: 'left' }}>
                      {m.view_count > 0 ? <><AppIcon name="eye" size={10} style={{ verticalAlign:'middle', marginRight:2 }} />{m.view_count} · </> : ''}{timeStr}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)' }}>
        <Button onClick={onJoin} disabled={joining}>
          {joining ? 'Uniéndose...' : `Unirse a ${channel.name}`}
        </Button>
      </div>
    </motion.div>
  )
}
