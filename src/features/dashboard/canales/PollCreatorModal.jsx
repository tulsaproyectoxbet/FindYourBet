import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { clampLines, LINE_LIMIT } from '../../../lib/textLimits'
import AppIcon from '../../../components/ui/AppIcon'

export default function PollCreatorModal({ channelId, userId, onClose, onSent }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const addOption = () => {
    if (options.length >= 6) return
    setOptions(prev => [...prev, ''])
  }

  const removeOption = (i) => {
    if (options.length <= 2) return
    setOptions(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateOption = (i, val) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o))
  }

  const handleSend = async () => {
    const q = question.trim()
    const opts = options.map(o => o.trim()).filter(Boolean)
    if (!q) { setError('Escribe una pregunta.'); return }
    if (opts.length < 2) { setError('Añade al menos 2 opciones con texto.'); return }
    setSending(true)
    setError('')
    const content = `[POLL]:${JSON.stringify({ question: q, options: opts, allowMultiple })}`
    const { error: err } = await supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    })
    if (err) { setError('Error al publicar la encuesta.'); setSending(false); return }
    onSent?.()
    onClose()
  }

  const inputSt = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
  const canSend = question.trim() && options.filter(o => o.trim()).length >= 2

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="vote" size={16} /> Crea una encuesta</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', lineHeight: 1 }}><AppIcon name="close" size={18} /></button>
        </div>

        {error && (
          <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Pregunta */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Pregunta</div>
          <textarea
            autoFocus
            value={question}
            onChange={e => setQuestion(clampLines(e.target.value, LINE_LIMIT.FORM))}
            placeholder="¿Cuál es tu pregunta?"
            rows={2}
            maxLength={200}
            style={{ ...inputSt, resize: 'vertical', fontSize: '14px', padding: '12px 14px' }}
          />
        </div>

        {/* Opcions */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Opciones de respuesta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Opción ${i + 1}`}
                  maxLength={80}
                  style={{ ...inputSt, flex: 1, fontSize: '13px', padding: '9px 12px' }}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button onClick={addOption}
              style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'transparent', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '16px' }}>+</span>
              <span>Añadir respuesta</span>
            </button>
          )}
        </div>

        {/* Toggle múltiple */}
        <div onClick={() => setAllowMultiple(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px', background: 'var(--color-bg-soft)', border: `0.5px solid ${allowMultiple ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '22px', transition: 'border-color 0.15s' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Permitir varias respuestas</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>Los participantes pueden elegir más de una opción</div>
          </div>
          <div style={{ width: '40px', height: '22px', borderRadius: '999px', background: allowMultiple ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '3px', left: allowMultiple ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>

        <button onClick={handleSend} disabled={sending || !canSend}
          style={{ width: '100%', padding: '13px', background: canSend ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: canSend ? '#010906' : 'var(--color-text-muted)', border: 'none', borderRadius: 'var(--radius-md)', cursor: canSend ? 'pointer' : 'default', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
          {sending ? 'Publicando...' : <><AppIcon name="send" size={14} style={{ marginRight: 6 }} /> Publicar encuesta</>}
        </button>
      </motion.div>
    </motion.div>
  )
}
