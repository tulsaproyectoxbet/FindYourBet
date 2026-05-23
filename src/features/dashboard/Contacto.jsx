import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'var(--color-warning)',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  resolved: { label: 'Arreglado',  color: 'var(--color-primary)', bg: 'var(--color-primary-light)', border: 'var(--color-primary-border)' },
  rejected: { label: 'Rechazado', color: 'var(--color-error)',    bg: 'var(--color-error-light)',   border: 'var(--color-error-border)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 'var(--radius-full)', padding: '2px 10px' }}>
      {cfg.label}
    </span>
  )
}

function MisPeticiones({ user }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    supabase.from('support_tickets')
      .select('id, title, message, status, admin_response, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTickets(data || []); setLoading(false) })
  }, [user?.id])

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>⏳ Cargando...</div>
  if (!tickets.length) return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      No tienes peticiones enviadas aún.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {tickets.map(t => (
        <div key={t.id} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {new Date(t.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <StatusBadge status={t.status} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded === t.id ? '▲' : '▼'}</span>
          </div>
          {expanded === t.id && (
            <div style={{ padding: '0 16px 14px', borderTop: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Tu mensaje</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.message}</div>
              {t.admin_response && (
                <div style={{ marginTop: '12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.7px' }}>💬 Respuesta de FYB</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.admin_response}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RedesSoporte({ user }) {
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!title.trim() || !problem.trim()) return
    setLoading(true)
    await supabase.from('support_tickets').insert({
      user_id: user?.id || null,
      email: user?.email || '',
      title: title.trim(),
      message: problem.trim(),
      status: 'pending',
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h2>Redes sociales & Soporte</h2>
        <p>Síguenos y contáctanos por el canal que prefieras.</p>
      </div>

      <div style={{ marginBottom: '24px', maxWidth: '360px' }}>
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
      </div>

      {/* Formulari */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px', marginBottom: '24px' }}>
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '24px', color: 'var(--color-primary)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>¡Mensaje recibido!</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Te responderemos en menos de 24h. Puedes seguir el estado en "Estado de mi petición".</div>
          </motion.div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>¿Tienes un problema?</div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px', marginTop: 0 }}>
              Cuéntanos qué ha pasado con el mayor detalle posible y lo resolveremos lo antes posible.
            </p>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Título</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Resume tu problema en una frase..."
                style={{ ...inputStyle }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Explícanos con detalle tu problema</label>
              <textarea
                rows={5}
                value={problem}
                onChange={e => setProblem(e.target.value)}
                placeholder="Describe paso a paso qué ha ocurrido, qué esperabas y qué ha pasado en su lugar..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <button onClick={handleSend} disabled={!title.trim() || !problem.trim() || loading}
              style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', opacity: (!title.trim() || !problem.trim() || loading) ? 0.5 : 1 }}>
              {loading ? 'Enviando...' : 'Enviar problema'}
            </button>
          </>
        )}
      </div>

      {/* Estat de les peticions */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>📋 Estado de mi petición</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '16px' }}>
          Aquí puedes consultar el estado de todos tus problemas enviados y ver si el equipo te ha respondido.
        </p>
        <MisPeticiones user={user} />
      </div>
    </motion.div>
  )
}

function Sugerencias({ user }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return
    setLoading(true)
    // Guarda la suggerència a Supabase per revisar-la des del Studio
    await supabase.from('suggestions').insert({
      user_id: user?.id || null,
      message: message.trim(),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h2>Ayúdanos a mejorar</h2>
        <p>Tu opinión construye FindYourBet.</p>
      </div>

      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px' }}>

        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '32px', color: 'var(--color-primary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>¡Gracias por tu sugerencia!</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>El equipo de FYB la revisará y, si encaja con la visión de la plataforma, la implementará.</div>
          </motion.div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px', marginTop: 0 }}>
              ¿Echas algo en falta? ¿Tienes una idea que haría FYB mejor? Cuéntanosla. Leemos todas las sugerencias y las mejores acaban convirtiéndose en funcionalidades reales de la plataforma.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Tu sugerencia</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={5} placeholder="Cuéntanos tu idea..." value={message} onChange={e => setMessage(e.target.value)} />
            </div>
            <button onClick={handleSend} disabled={!message.trim() || loading}
              style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', opacity: (!message.trim() || loading) ? 0.5 : 1 }}>
              {loading ? 'Enviando...' : 'Enviar sugerencia'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function Contacto({ initialTab, user }) {
  if (initialTab === 'sugerencias') return <Sugerencias user={user} />
  return <RedesSoporte user={user} />
}