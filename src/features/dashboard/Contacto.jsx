import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { clampLines, stripEmojis, LINE_LIMIT } from '../../lib/textLimits'
import AppIcon from '../../components/ui/AppIcon'

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'var(--color-warning)',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  resolved: { label: 'Arreglado',  color: 'var(--color-primary)', bg: 'var(--color-primary-light)', border: 'var(--color-primary-border)' },
  accepted: { label: 'Aceptada',   color: 'var(--color-primary)', bg: 'var(--color-primary-light)', border: 'var(--color-primary-border)' },
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

const SectionHeader = ({ children }) => (
  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', marginTop: '4px' }}>
    {children}
  </div>
)

function MisPeticiones({ user }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    supabase.from('support_tickets')
      .select('id, title, message, status, admin_response, image_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTickets(data || []); setLoading(false) })
  }, [user?.id])

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><AppIcon name="loading" size={14} /> Cargando...</div>
  if (!tickets.length) return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      No tienes peticiones enviadas aún.
    </div>
  )

  const pending = tickets.filter(t => (t.status || 'pending') === 'pending')
  const history = tickets.filter(t => (t.status || 'pending') !== 'pending')

  const renderItem = (t) => (
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
          {t.image_url && (
            <a href={t.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '10px' }}>
              <img src={t.image_url} alt="Adjunto" style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', cursor: 'pointer' }} />
            </a>
          )}
          {t.admin_response ? (
            <div style={{ marginTop: '12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'flex', alignItems: 'center', gap: '4px' }}><AppIcon name="social" size={11} /> Respuesta de FYB</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.admin_response}</div>
            </div>
          ) : t.status && t.status !== 'pending' && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '8px' }}>
              La petición ya ha sido determinada.
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <SectionHeader><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="loading" size={11} /> Pendientes ({pending.length})</span></SectionHeader>
      {pending.length === 0
        ? <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 4px' }}>No tienes peticiones pendientes.</div>
        : pending.map(renderItem)}

      {history.length > 0 && (
        <>
          <SectionHeader><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="historial" size={11} /> Historial ({history.length})</span></SectionHeader>
          {history.map(renderItem)}
        </>
      )}
    </div>
  )
}

function MisSugerencias({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    supabase.from('suggestions')
      .select('id, title, message, status, admin_response, image_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [user?.id])

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><AppIcon name="loading" size={14} /> Cargando...</div>
  if (!items.length) return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      No tienes sugerencias enviadas aún.
    </div>
  )

  const pending = items.filter(s => (s.status || 'pending') === 'pending')
  const history = items.filter(s => (s.status || 'pending') !== 'pending')

  const renderItem = (s) => {
    const header = s.title || (s.message || '').slice(0, 80)
    return (
      <div key={s.id} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div onClick={() => setExpanded(expanded === s.id ? null : s.id)}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{header}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <StatusBadge status={s.status || 'pending'} />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{expanded === s.id ? '▲' : '▼'}</span>
        </div>
        {expanded === s.id && (
          <div style={{ padding: '0 16px 14px', borderTop: '0.5px solid var(--color-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Tu sugerencia</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.message}</div>
            {s.image_url && (
              <a href={s.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '10px' }}>
                <img src={s.image_url} alt="Adjunto" style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', cursor: 'pointer' }} />
              </a>
            )}
            {s.admin_response ? (
              <div style={{ marginTop: '12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'flex', alignItems: 'center', gap: '4px' }}><AppIcon name="social" size={11} /> Respuesta de FYB</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.admin_response}</div>
              </div>
            ) : s.status && s.status !== 'pending' && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '8px' }}>
                La sugerencia ya ha sido determinada.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <SectionHeader><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="loading" size={11} /> Pendientes ({pending.length})</span></SectionHeader>
      {pending.length === 0
        ? <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '6px 4px' }}>No tienes sugerencias pendientes.</div>
        : pending.map(renderItem)}

      {history.length > 0 && (
        <>
          <SectionHeader><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="historial" size={11} /> Historial ({history.length})</span></SectionHeader>
          {history.map(renderItem)}
        </>
      )}
    </div>
  )
}

function RedesSoporte({ user }) {
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleImageChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    if (f.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const handleSend = async () => {
    if (!title.trim() || !problem.trim()) return
    setLoading(true)
    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `support/${user?.id || 'anon'}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('channel-files').upload(path, imageFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
        imageUrl = urlData?.publicUrl || null
      }
    }
    await supabase.from('support_tickets').insert({
      user_id: user?.id || null,
      email: user?.email || '',
      title: title.trim(),
      message: problem.trim(),
      status: 'pending',
      image_url: imageUrl,
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
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="phone" size={15} /> Redes sociales</div>
          {[
            {
              name: 'X', handle: '@fyourbet', url: 'https://x.com/fyourbet',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              ),
            },
            {
              name: 'Instagram', handle: '@fyourbet', url: 'https://instagram.com/fyourbet',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5.5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              ),
            },
            {
              name: 'TikTok', handle: '@fyourbet', url: 'https://tiktok.com/@fyourbet',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3c-1.36 0-2.6-.55-3.34-1.48z" />
                </svg>
              ),
            },
          ].map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" aria-label={s.name}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)', textDecoration: 'none', color: 'var(--color-text)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>{s.handle}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Formulari */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px', marginBottom: '24px' }}>
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '24px', color: 'var(--color-primary)' }}>
            <div style={{ marginBottom: '12px' }}><AppIcon name="success" size={36} color="var(--color-primary)" /></div>
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
                onChange={e => setTitle(stripEmojis(e.target.value))}
                placeholder="Resume tu problema en una frase..."
                maxLength={100}
                style={{ ...inputStyle }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Explícanos con detalle tu problema</label>
              <textarea
                rows={5}
                value={problem}
                onChange={e => setProblem(clampLines(stripEmojis(e.target.value), LINE_LIMIT.FORM))}
                placeholder="Describe paso a paso qué ha ocurrido, qué esperabas y qué ha pasado en su lugar..."
                maxLength={3000}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Imagen (opcional)</label>
              {imagePreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={imagePreview} alt="" style={{ maxWidth: '200px', maxHeight: '160px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }} />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--color-bg-soft)', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
                  <AppIcon name="camera" size={14} /> Adjuntar imagen
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
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
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="historial" size={16} /> Estado de mi petición</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '16px' }}>
          Aquí puedes consultar el estado de todos tus problemas enviados y ver si el equipo te ha respondido.
        </p>
        <MisPeticiones user={user} />
      </div>
    </motion.div>
  )
}

function Sugerencias({ user }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleImageChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    if (f.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return
    setLoading(true)
    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `suggestions/${user?.id || 'anon'}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('channel-files').upload(path, imageFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
        imageUrl = urlData?.publicUrl || null
      }
    }
    await supabase.from('suggestions').insert({
      user_id: user?.id || null,
      title: title.trim(),
      message: message.trim(),
      image_url: imageUrl,
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

      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px', marginBottom: '24px' }}>

        {sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '32px', color: 'var(--color-primary)' }}>
            <div style={{ marginBottom: '12px' }}><AppIcon name="success" size={40} color="var(--color-primary)" /></div>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>¡Gracias por tu sugerencia!</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>El equipo de FYB la revisará y, si encaja con la visión de la plataforma, la implementará. Puedes seguir el estado en "Estado de mi sugerencia".</div>
          </motion.div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px', marginTop: 0 }}>
              ¿Echas algo en falta? ¿Tienes una idea que haría FYB mejor? Cuéntanosla. Leemos todas las sugerencias y las mejores acaban convirtiéndose en funcionalidades reales de la plataforma.
            </p>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Título</label>
              <input
                value={title}
                onChange={e => setTitle(stripEmojis(e.target.value))}
                placeholder="Resume tu idea en una frase..."
                maxLength={100}
                style={{ ...inputStyle }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Tu sugerencia</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={5} placeholder="Cuéntanos tu idea con detalle..." value={message} onChange={e => setMessage(clampLines(stripEmojis(e.target.value), LINE_LIMIT.FORM))} maxLength={3000} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Imagen (opcional)</label>
              {imagePreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={imagePreview} alt="" style={{ maxWidth: '200px', maxHeight: '160px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }} />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                    style={{ position: 'absolute', top: '-8px', right: '-8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ) : (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--color-bg-soft)', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
                  <AppIcon name="camera" size={14} /> Adjuntar imagen
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            <button onClick={handleSend} disabled={!title.trim() || !message.trim() || loading}
              style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', opacity: (!title.trim() || !message.trim() || loading) ? 0.5 : 1 }}>
              {loading ? 'Enviando...' : 'Enviar sugerencia'}
            </button>
          </>
        )}
      </div>

      {/* Estat de les suggerències de l'usuari */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '560px' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="sugerencias" size={16} /> Estado de mi sugerencia</div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '16px' }}>
          Aquí puedes consultar el estado de todas tus sugerencias y ver si el equipo te ha respondido.
        </p>
        <MisSugerencias user={user} />
      </div>
    </motion.div>
  )
}

export default function Contacto({ initialTab, user }) {
  if (initialTab === 'sugerencias') return <Sugerencias user={user} />
  return <RedesSoporte user={user} />
}