import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { clampLines, stripEmojis, LINE_LIMIT } from '../../../lib/textLimits'
import AppIcon from '../../../components/ui/AppIcon'

const REPORT_REASONS = [
  { value: 'Spam o publicidad no deseada',             labelKey: 'reportUser.spam' },
  { value: 'Contenido sexual o inapropiado',           labelKey: 'reportUser.sexual' },
  { value: 'Nombre o foto de perfil inapropiada',      labelKey: 'reportUser.inappropriateProfile' },
  { value: 'Acoso o comportamiento abusivo',           labelKey: 'reportUser.harassment' },
  { value: 'Cuenta falsa o suplantación de identidad', labelKey: 'reportUser.fakeAccount' },
  { value: 'Lenguaje ofensivo u odio',                 labelKey: 'reportUser.hate' },
  { value: 'Otro',                                     labelKey: 'reportUser.other' },
]

export default function ReportUserModal({ reportedId, reportedUsername, reporterId, onClose }) {
  const { t } = useTranslation()
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
      setError(t('reportUser.cooldown', { s: wait }))
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
      setError(t('reportUser.errorSend'))
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
              <div style={{ marginBottom: '12px' }}><AppIcon name="success" size={40} color="var(--color-primary)" /></div>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>{t('reportUser.sent')}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                {t('reportUser.sentDesc', { username: reportedUsername })}
              </div>
              <button onClick={onClose}
                style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="flag" size={17} /> {t('reportUser.title')}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {t('reportUser.subtitle', { username: reportedUsername })}
                  </div>
                </div>
                <button onClick={onClose}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', width: '30px', height: '30px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                  <AppIcon name="close" size={14} />
                </button>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                {t('reportUser.reasonLabel')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
                {REPORT_REASONS.map(r => (
                  <label key={r.value} onClick={() => setReason(r.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${reason === r.value ? 'var(--color-primary)' : 'var(--color-border)'}`, background: reason === r.value ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: `2px solid ${reason === r.value ? 'var(--color-primary)' : 'var(--color-text-muted)'}`, background: reason === r.value ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {reason === r.value && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#010906' }} />}
                    </div>
                    <span style={{ fontSize: '13px', color: reason === r.value ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: reason === r.value ? 600 : 400 }}>{t(r.labelKey)}</span>
                  </label>
                ))}
              </div>

              {reason === 'Otro' && (
                <textarea
                  value={details}
                  onChange={e => setDetails(clampLines(stripEmojis(e.target.value), LINE_LIMIT.FORM))}
                  placeholder={t('reportUser.detailsPlaceholder')}
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
                  {t('common.cancel')}
                </button>
                <button onClick={handleSubmit} disabled={!reason || sending}
                  style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: reason ? 'var(--color-error)' : 'var(--color-bg-soft)', color: reason ? '#fff' : 'var(--color-text-muted)', cursor: reason ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: sending ? 0.7 : 1, transition: 'all 0.15s' }}>
                  {sending ? t('reportUser.sending') : t('reportUser.submit')}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
