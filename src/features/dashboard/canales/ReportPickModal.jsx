import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { clampLines, stripEmojis, LINE_LIMIT } from '../../../lib/textLimits'
import AppIcon from '../../../components/ui/AppIcon'

// Llindar combinat: mínim 5 reports I taxa >= 15% sobre el total de vistes.
// Si no hi ha vistes registrades, qualsevol >= 5 reports dispara revisió.
export const REPORT_THRESHOLD = 5
const RATE_THRESHOLD = 0.15

const REASONS = [
  { id: 'resultado_manipulado', labelKey: 'reportPick.resultManipulated', descKey: 'reportPick.resultManipulatedDesc' },
  { id: 'cuota_editada',        labelKey: 'reportPick.oddsEdited',        descKey: 'reportPick.oddsEditedDesc' },
  { id: 'informacion_falsa',    labelKey: 'reportPick.falseInfo',         descKey: 'reportPick.falseInfoDesc' },
  { id: 'pick_duplicado',       labelKey: 'reportPick.duplicate',         descKey: 'reportPick.duplicateDesc' },
  { id: 'otros',                labelKey: 'reportPick.other',             descKey: 'reportPick.otherDesc' },
]

export default function ReportPickModal({ bet, currentUser, onClose }) {
  const { t } = useTranslation()
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
        setError(t('reportPick.alreadyReported'))
      } else {
        setError(t('reportPick.errorSend'))
      }
      setLoading(false)
      return
    }

    // Comprova si s'ha assolit el llindar combinat: >= 5 reports I taxa >= 15%
    const { count } = await supabase.from('bet_reports')
      .select('*', { count: 'exact', head: true })
      .eq('bet_id', bet.id)

    if ((count ?? 0) >= REPORT_THRESHOLD) {
      // Obté el total de vistes (canal + feed + DMs) per calcular la taxa
      let totalViews = 0
      try {
        const { data: viewData } = await supabase.rpc('get_bet_total_views_batch', { p_bet_ids: [bet.id] })
        totalViews = viewData?.[0]?.view_count ?? 0
      } catch { /* fallback: sense vistes, la taxa es considera 100% */ }

      // Si no hi ha vistes registrades, qualsevol >= 5 reports és prou greu per revisar
      const rate = totalViews > 0 ? (count / totalViews) : 1

      if (rate >= RATE_THRESHOLD) {
        await supabase.from('bets')
          .update({ review_status: 'review' })
          .eq('id', bet.id)
          .is('review_status', null)
      }
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
              <div style={{ marginBottom: '12px' }}><AppIcon name="success" size={36} color="var(--color-primary)" /></div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>{t('reportPick.sent')}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                {t('reportPick.sentDesc')}
              </div>
              <button onClick={onClose}
                style={{ padding: '10px 28px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="flag" size={15} /> {t('reportPick.title')}</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0 4px', display: 'flex' }}><AppIcon name="close" size={18} /></button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '18px' }}>
                Pick: <strong>{bet.event || t('reportPick.photoPickLabel')}</strong>
              </div>

              {/* Motius predefinits */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {REASONS.map(r => (
                  <div key={r.id} onClick={() => setReason(r.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${reason === r.id ? 'var(--color-error)' : 'var(--color-border)'}`, background: reason === r.id ? 'rgba(239,68,68,0.06)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${reason === r.id ? 'var(--color-error)' : 'var(--color-border)'}`, background: reason === r.id ? 'var(--color-error)' : 'transparent', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: reason === r.id ? 700 : 500, color: reason === r.id ? 'var(--color-error)' : 'var(--color-text)' }}>{t(r.labelKey)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{t(r.descKey)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Camp de detalls — sempre visible però obligatori per "otros" */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  {t('reportPick.detailsLabel')} {reason === 'otros' ? '*' : t('reportPick.optional')}
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(clampLines(stripEmojis(e.target.value), LINE_LIMIT.FORM))}
                  placeholder={t('reportPick.detailsPlaceholder')}
                  rows={3}
                  maxLength={500}
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
                  {loading ? t('reportPick.sending') : t('reportPick.submit')}
                </button>
                <button onClick={onClose}
                  style={{ padding: '11px 18px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
