import { useState } from 'react'
import { motion } from 'framer-motion'

// Modal de bloqueig en dos passos:
//  1) Confirmació de l'operació (botó típic de confirmar).
//  2) Un cop bloquejat, ofereix reportar l'usuari. Si accepta, es delega a onReport
//     (que obre el ReportUserModal amb el flux normal de motiu).
export default function BlockUserModal({ username, onConfirm, onReport, onClose }) {
  const [blocked, setBlocked] = useState(false)
  const [working, setWorking] = useState(false)

  const handleBlock = async () => {
    if (working) return
    setWorking(true)
    await onConfirm()
    setWorking(false)
    setBlocked(true)
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
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                ¿Bloquear a {username}?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                No podrá enviarte mensajes ni ver tu actividad, y se eliminará vuestra conversación. Podrás desbloquearlo cuando quieras.
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={onClose}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleBlock} disabled={working}
                  style={{ padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: working ? 0.7 : 1 }}>
                  {working ? 'Bloqueando...' : 'Bloquear'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                Has bloqueado a {username}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                ¿Quieres reportar al usuario? Ayúdanos a mantener FYB seguro indicando el motivo.
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={onClose}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  No, gracias
                </button>
                <button onClick={() => { onClose(); onReport?.() }}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-warning, #f59e0b)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  🚩 Sí, reportar
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
