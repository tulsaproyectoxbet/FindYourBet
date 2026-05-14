import { useState } from 'react'
import { motion } from 'framer-motion'

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }

function RedesSoporte() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h2>Redes sociales & Soporte</h2>
        <p>Síguenos y contáctanos por el canal que prefieras.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>📱 Redes sociales</div>
          {[
            { icon: '𝕏', name: 'X', handle: '@fyourbet', url: '#' },
            { icon: '📸', name: 'Instagram', handle: '@fyourbet', url: '#' },
            { icon: '▶️', name: 'YouTube', handle: '@fyourbet', url: '#' },
          ].map((s, i) => (
            <a key={i} href={s.url}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)', textDecoration: 'none', color: 'var(--color-text)' }}>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-primary)' }}>{s.handle}</div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>🛠️ Soporte</div>
          {[
            { icon: '📧', label: 'Email', value: 'soporte@fyourbet.com' },
            { icon: '⏱️', label: 'Horario', value: 'Lun–Vie, 9:00–18:00' },
            { icon: '⚡', label: 'Respuesta', value: 'Menos de 24h' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
              <span style={{ fontSize: '18px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{s.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Sugerencias() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!form.name || !form.email || !form.message) return
    setSent(true)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h2>Ayúdanos a mejorar</h2>
        <p>Tu opinión nos ayuda a construir una mejor plataforma.</p>
      </div>

      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>✉️ Envíanos tu sugerencia</div>

        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '32px', color: 'var(--color-primary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>¡Gracias por tu feedback!</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Lo tendremos en cuenta para mejorar FindYourBet.</div>
          </motion.div>
        ) : (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Nombre</label>
              <input style={inputStyle} placeholder="Tu nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Email</label>
              <input style={inputStyle} type="email" placeholder="tu@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Sugerencia o mejora</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} placeholder="¿Qué mejorarías de FindYourBet?" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            </div>
            <button onClick={handleSend} disabled={!form.name || !form.email || !form.message}
              style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', opacity: (!form.name || !form.email || !form.message) ? 0.5 : 1 }}>
              Enviar sugerencia
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function Contacto({ initialTab }) {
  if (initialTab === 'sugerencias') return <Sugerencias />
  return <RedesSoporte />
}