import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import AppIcon from './ui/AppIcon'

// Banner de consentiment de cookies (requisit ePrivacy / art. 22.2 LSSI).
// FYB només usa cookies tècniques necessàries, així que no bloquegem res: informem i
// deixem constància de l'acceptació. La decisió es desa a localStorage per no repetir.
const STORAGE_KEY = 'fyb_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Petit retard perquè no aparegui de cop en carregar (menys intrusiu).
    const t = setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    }, 800)
    return () => clearTimeout(t)
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }))
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{
            position: 'fixed', left: '16px', right: '16px', bottom: '16px', zIndex: 9999,
            maxWidth: '520px', margin: '0 auto',
            background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
            padding: '18px 20px', fontFamily: 'var(--font-sans)',
          }}>
          <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-text-soft)', marginBottom: '14px' }}>
            <AppIcon name="info" size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} /> Usamos <strong style={{ color: 'var(--color-text)' }}>cookies técnicas necesarias</strong> para
            iniciar tu sesión y recordar tus preferencias. No usamos cookies publicitarias.{' '}
            <span onClick={() => navigate('/legal/cookies')}
              style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
              Más información
            </span>.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/legal/cookies')}
              style={{ padding: '9px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              Ver política
            </button>
            <button onClick={accept}
              style={{ padding: '9px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Aceptar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
