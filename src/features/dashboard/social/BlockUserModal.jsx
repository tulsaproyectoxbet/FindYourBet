import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../../components/ui/AppIcon'

// Modal de bloqueig en dos passos:
//  1) Confirmació de l'operació (botó típic de confirmar).
//  2) Un cop bloquejat, ofereix reportar l'usuari. Si accepta, es delega a onReport
//     (que obre el ReportUserModal amb el flux normal de motiu).
export default function BlockUserModal({ username, onConfirm, onReport, onClose }) {
  const { t } = useTranslation()
  const [blocked, setBlocked] = useState(false)
  const [working, setWorking] = useState(false)

  const handleBlock = async () => {
    if (working) return
    setWorking(true)
    try {
      await onConfirm()
      setBlocked(true)
    } catch {
      // silent — el pare ja gestiona l'error
    } finally {
      setWorking(false)
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
        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '28px', maxWidth: '420px', width: '100%', pointerEvents: 'auto', textAlign: 'center' }}>
          {!blocked ? (
            <>
              <div style={{ marginBottom: '12px' }}><AppIcon name="ban" size={40} /></div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                {t('blockModal.title', { username })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('blockModal.desc')}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={onClose}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  {t('common.cancel')}
                </button>
                <button onClick={handleBlock} disabled={working}
                  style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: working ? 0.7 : 1 }}>
                  {working ? t('blockModal.blocking') : t('social.block')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '12px' }}><AppIcon name="success" size={40} color="var(--color-primary)" /></div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                {t('blockModal.blocked', { username })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t('blockModal.reportPrompt')}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={onClose}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  {t('blockModal.noThanks')}
                </button>
                <button onClick={() => { onClose(); onReport?.() }}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-warning, #f59e0b)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  <><AppIcon name="flag" size={13} style={{ marginRight: 5 }} /> {t('blockModal.yesReport')}</>
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
