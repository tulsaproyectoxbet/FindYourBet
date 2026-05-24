import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function AccesoPage({ user }) {
  const { token } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState('loading') // loading | valid | invalid
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!user) {
      // Preserva la URL d'accés per tornar-hi després del login
      navigate(`/login?redirect=/acceso/${token}`)
      return
    }
    validate()
  }, [user, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const validate = async () => {
    try {
      const res = await fetch(`/api/validate-access?token=${token}&user_id=${user.id}`)
      if (!res.ok) { setState('invalid'); return }
      setData(await res.json())
      setState('valid')
    } catch {
      setState('invalid')
    }
  }

  const handleEntrar = () => {
    // L'usuari ja és membre (webhook l'ha afegit); el paràmetre ?canal= obre el canal directament
    navigate(`/dashboard?canal=${data.channel.invite_code}`)
  }

  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ fontSize: '32px' }}>⏳</div>
    </div>
  )

  if (state === 'invalid') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', padding: '24px' }}>
      <div style={{ fontSize: '48px' }}>🔒</div>
      <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--color-text)', textAlign: 'center' }}>Enlace no válido</div>
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6 }}>
        Este enlace no pertenece a tu cuenta o ya ha caducado. Asegúrate de acceder con el email con el que compraste.
      </div>
      <button onClick={() => navigate('/dashboard')}
        style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 28px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)', marginTop: '8px' }}>
        Ir al dashboard
      </button>
    </div>
  )

  const { channel, tipster, offer } = data

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', padding: '24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Card principal */}
        <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>

          {/* Icona check */}
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--color-primary)', fontWeight: 700 }}>
            ✓
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--color-text)', marginBottom: '6px' }}>
              Acceso al canal
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {offer?.name && <span>Compraste <strong style={{ color: 'var(--color-text)' }}>{offer.name}</strong><br /></span>}
              Canal de <strong style={{ color: 'var(--color-text)' }}>@{tipster?.username}</strong>
            </div>
          </div>

          {/* Info canal */}
          <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', width: '100%', textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Canal</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text)', marginBottom: channel.description ? '6px' : 0 }}>
              {channel.name}
            </div>
            {channel.description && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{channel.description}</div>
            )}
          </div>

          <button onClick={handleEntrar}
            style={{ width: '100%', background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Entrar al canal →
          </button>
        </div>

        {/* Codi alternatiu */}
        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Codi d'accés alternatiu</div>
          <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 800, letterSpacing: '4px', color: 'var(--color-text)' }}>
            {channel.invite_code.toUpperCase()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Canales → cerca per codi a FindYourBet
          </div>
        </div>

      </motion.div>
    </div>
  )
}
