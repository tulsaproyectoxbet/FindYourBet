import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

export default function PaymentSuccess({ user }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const sessionId = searchParams.get('session_id')

  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }

    let attempts = 0
    const poll = async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id, token, offers(name), channels(name, invite_code)')
        .eq('stripe_session_id', sessionId)
        .maybeSingle()

      if (data) {
        setPurchase(data)
        setLoading(false)
        // Marca com a notificada perquè el Dashboard no la torni a mostrar
        localStorage.setItem(`fyb_purchase_notified_${data.id}`, '1')
      } else if (attempts < 10) {
        attempts++
        setTimeout(poll, 1500)
      } else {
        setLoading(false)
      }
    }
    poll()
  }, [sessionId])

  const accessLink = purchase?.token
    ? `${window.location.origin}/acceso/${purchase.token}`
    : null

  const handleCopy = () => {
    navigator.clipboard.writeText(accessLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEntrar = () => {
    navigate(`/dashboard?canal=${purchase.channels?.invite_code}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <AppIcon name="loading" size={32} />
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{t('paymentSuccess.confirming')}</div>
    </div>
  )

  if (!purchase) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', padding: '24px' }}>
      <AppIcon name="warning" size={48} color="var(--color-warning, #f59e0b)" />
      <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-text)', textAlign: 'center' }}>{t('paymentSuccess.paymentReceived')}</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '320px' }}>
        {t('paymentSuccess.processingDesc')}
      </div>
      <button onClick={() => navigate('/dashboard')}
        style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
        {t('paymentSuccess.goDashboard')}
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', padding: '24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Header d'èxit */}
        <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <AppIcon name="check" size={28} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--color-text)', marginBottom: '6px' }}>{t('paymentSuccess.title')}</div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {purchase.offers?.name && <span>{t('paymentSuccess.bought')} <strong style={{ color: 'var(--color-text)' }}>{purchase.offers.name}</strong><br /></span>}
              {t('paymentSuccess.channel')} <strong style={{ color: 'var(--color-text)' }}>{purchase.channels?.name}</strong>
            </div>
          </div>

          {/* Enlace personal */}
          <div style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
              {t('paymentSuccess.yourLink')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-primary)', wordBreak: 'break-all', marginBottom: '10px', lineHeight: 1.5 }}>
              {accessLink}
            </div>
            <button onClick={handleCopy}
              style={{ width: '100%', padding: '9px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${copied ? 'var(--color-primary)' : 'var(--color-border)'}`, background: copied ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
              {copied ? <><AppIcon name="check" size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('paymentSuccess.copied')}</> : <><AppIcon name="copy" size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('paymentSuccess.copyLink')}</>}
            </button>
          </div>

          <button onClick={handleEntrar}
            style={{ width: '100%', background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '15px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
            {t('paymentSuccess.enterChannel')}
          </button>
        </div>

        {/* Codi alternatiu */}
        <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('paymentSuccess.altCode')}</div>
          <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 800, letterSpacing: '4px', color: 'var(--color-text)' }}>
            {purchase.channels?.invite_code?.toUpperCase()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{t('paymentSuccess.altCodeHint')}</div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>
          <AppIcon name="mail" size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} /> {t('paymentSuccess.emailSent')}
        </div>

      </motion.div>
    </div>
  )
}
