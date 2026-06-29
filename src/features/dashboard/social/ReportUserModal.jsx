import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'

const REPORT_REASONS = [
  'Spam o publicidad no deseada',
  'Contenido sexual o inapropiado',
  'Nombre o foto de perfil inapropiada',
  'Acoso o comportamiento abusivo',
  'Cuenta falsa o suplantación de identidad',
  'Lenguaje ofensivo u odio',
  'Otro',
]

export default function ReportUserModal({ reportedId, reportedUsername, reporterId, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Throttle global de reports: evita saturar la BD amb inserts repetits.
  const REPORT_COOLDOWN_MS = 10000

  const handleSubmit = async () => {
    if (!reason || sending) return
    setError('')

    // 1) Rate limit client: com a molt un report cada 10 segons.
    const last = parseInt(localStorage.getItem('fyb_last_report_at') || '0', 10)
    if (Date.now() - last < REPORT_COOLDOWN_MS) {
      const wait = Math.ceil((REPORT_COOLDOWN_MS - (Date.now() - last)) / 1000)
      setError(`Espera ${wait}s antes de enviar otro reporte.`)
      return
    }

    setSending(true)
    try {
      // 2) Dedup: només compta el PRIMER report d'aquest usuari sobre l'altre.
      // Si ja n'hi ha un, no inserim un duplicat (es mostra com enviat igualment).
      const { data: existing } = await supabase
        .from('user_reports')
        .select('id')
        .eq('reporter_id', reporterId)
        .eq('reported_id', reportedId)
        .limit(1)
        .maybeSingle()

      if (!existing) {
        await supabase.from('user_reports').insert({
          reporter_id: reporterId,
          reported_id: reportedId,
          reason,
          details: reason === 'Otro' && details.trim() ? details.trim() : null,
          status: 'pending',
        })
      }
      localStorage.setItem('fyb_last_report_at', String(Date.now()))
      setSent(true)
    } catch {
      setError('No se pudo enviar el reporte. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        style={{ position: 'fixed', inset: 0, zIndex: 301, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', pointerEvents: 'none' }}
      >
        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '28px', maxWidth: '440px', width: '100%', pointerEvents: 'auto' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>Reporte enviado</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                Revisaremos el perfil de <strong>{reportedUsername}</strong> lo antes posible.
              </div>
              <button onClick={onClose}
                style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '3px' }}>🚩 Reportar usuario</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    ¿Quieres reportar a <strong style={{ color: 'var(--color-text)' }}>{reportedUsername}</strong>?
                  </div>
                </div>
                <button onClick={onClose}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', width: '30px', height: '30px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Motivo del reporte
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
                {REPORT_REASONS.map(r => (
                  <label key={r} onClick={() => setReason(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${reason === r ? 'var(--color-primary)' : 'var(--color-border)'}`, background: reason === r ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: `2px solid ${reason === r ? 'var(--color-primary)' : 'var(--color-text-muted)'}`, background: reason === r ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {reason === r && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#010906' }} />}
                    </div>
                    <span style={{ fontSize: '13px', color: reason === r ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: reason === r ? 600 : 400 }}>{r}</span>
                  </label>
                ))}
              </div>

              {reason === 'Otro' && (
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Describe el problema..."
                  maxLength={500}
                  rows={3}
                  style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
              )}

              {error && (
                <div style={{ fontSize: '12px', color: 'var(--color-error)', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '12px' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: reason === 'Otro' ? 0 : '4px' }}>
                <button onClick={onClose}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSubmit} disabled={!reason || sending}
                  style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: reason ? 'var(--color-error)' : 'var(--color-bg-soft)', color: reason ? '#fff' : 'var(--color-text-muted)', cursor: reason ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: sending ? 0.7 : 1, transition: 'all 0.15s' }}>
                  {sending ? 'Enviando...' : 'Reportar'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
