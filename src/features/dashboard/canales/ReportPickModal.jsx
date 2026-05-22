import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'

// Quants reports fan falta perquè un pick entri en revisió automàtica.
// Canviar aquest valor quan es determini el número definitiu.
export const REPORT_THRESHOLD = 3

const REASONS = [
  { id: 'resultado_manipulado', label: 'Resultado manipulado', desc: 'Ha marcado el pick como ganado/perdido incorrectamente' },
  { id: 'cuota_editada',        label: 'Cuota editada',        desc: 'La cuota fue modificada después de publicar el pick' },
  { id: 'informacion_falsa',    label: 'Información falsa',    desc: 'Datos del evento o mercado incorrectos o inventados' },
  { id: 'pick_duplicado',       label: 'Pick duplicado',       desc: 'Este pick ya fue publicado anteriormente' },
  { id: 'otros',                label: 'Otros',                desc: 'Otro motivo — explícalo en el campo de abajo' },
]

export default function ReportPickModal({ bet, currentUser, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = !!reason && (reason !== 'otros' || details.trim().length > 10)

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')

    // Insereix el report. La constraint unique(bet_id, reporter_id) evita
    // que el mateix usuari reporti el mateix pick dues vegades.
    const { error: insertErr } = await supabase.from('bet_reports').insert({
      bet_id: bet.id,
      reporter_id: currentUser.id,
      reason,
      details: details.trim() || null,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        setError('Ya has reportado este pick anteriormente.')
      } else {
        setError('Error al enviar el reporte. Inténtalo de nuevo.')
      }
      setLoading(false)
      return
    }

    // Comprova si s'ha assolit el llindar de reports → posa el pick en revisió
    const { count } = await supabase.from('bet_reports')
      .select('*', { count: 'exact', head: true })
      .eq('bet_id', bet.id)

    if ((count ?? 0) >= REPORT_THRESHOLD) {
      await supabase.from('bets')
        .update({ review_status: 'review' })
        .eq('id', bet.id)
        .is('review_status', null) // només si encara no estava en revisió
    }

    setDone(true)
    setLoading(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '420px', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', border: '0.5px solid var(--color-border)', padding: '24px', boxSizing: 'border-box' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>Reporte enviado</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                Lo revisaremos lo antes posible. Si el pick acumula suficientes reportes, quedará suspendido automáticamente hasta que lo verifiquemos.
              </div>
              <button onClick={onClose}
                style={{ padding: '10px 28px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>🚩 Reportar pick</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '0 4px' }}>✕</button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
                Pick: <strong>{bet.event || 'Pick de foto'}</strong>
              </div>

              {/* Motius predefinits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {REASONS.map(r => (
                  <div key={r.id} onClick={() => setReason(r.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${reason === r.id ? 'var(--color-error)' : 'var(--color-border)'}`, background: reason === r.id ? 'rgba(239,68,68,0.06)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${reason === r.id ? 'var(--color-error)' : 'var(--color-border)'}`, background: reason === r.id ? 'var(--color-error)' : 'transparent', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: reason === r.id ? 700 : 500, color: reason === r.id ? 'var(--color-error)' : 'var(--color-text)' }}>{r.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Camp de detalls — sempre visible però obligatori per "otros" */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  Detalles {reason === 'otros' ? '*' : '(opcional)'}
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Explica con más detalle qué ha pasado..."
                  rows={3}
                  style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <div style={{ fontSize: '12px', color: 'var(--color-error)', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '12px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSubmit} disabled={!canSubmit || loading}
                  style={{ flex: 1, padding: '11px', background: canSubmit ? 'var(--color-error)' : 'var(--color-bg-soft)', color: canSubmit ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: 'var(--radius-md)', cursor: canSubmit ? 'pointer' : 'default', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                  {loading ? 'Enviando...' : 'Enviar reporte'}
                </button>
                <button onClick={onClose}
                  style={{ padding: '11px 18px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
