import { useState } from 'react'
import { motion } from 'framer-motion'

// Confirmació de sortida d'un canal amb opció de no tornar a preguntar.
// Si l'usuari marca la casella, el pare desa la preferència i les pròximes
// sortides s'executen directament sense aquest modal.
export default function LeaveChannelModal({ channelName, onConfirm, onClose }) {
  const [dontAsk, setDontAsk] = useState(false)

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
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚪</div>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
            ¿Salir del canal?
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
            Dejarás de ver los mensajes y picks de <strong style={{ color: 'var(--color-text)' }}>{channelName}</strong>. Podrás volver a unirte si es público o tienes el código de invitación.
          </div>

          {/* Casella "no volver a preguntar" */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: dontAsk ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', border: `0.5px solid ${dontAsk ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '20px', userSelect: 'none', transition: 'all 0.15s' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${dontAsk ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dontAsk ? 'var(--color-primary)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
              {dontAsk && <span style={{ color: '#010906', fontSize: '12px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} style={{ display: 'none' }} />
            <span style={{ fontSize: '13px', color: dontAsk ? 'var(--color-text)' : 'var(--color-text-muted)' }}>No volver a preguntar</span>
          </label>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              Cancelar
            </button>
            <button onClick={() => onConfirm(dontAsk)}
              style={{ flex: 1, padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Salir del canal
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
