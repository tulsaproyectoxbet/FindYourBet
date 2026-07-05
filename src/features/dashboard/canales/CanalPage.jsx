import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

export default function CanalPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          email: session.user.email,
        })
      }
    })

    const fetchChannel = async () => {
      // Safety timer + try/catch/finally: el spinner "Cargando canal..." mai penjat.
      const safetyTimer = setTimeout(() => setLoading(false), 10000)
      try {
        // Els invite_code es desen en lowercase; .ilike fa match case-insensitive
        // perquè funcioni tant amb codis antics (UPPER) com nous (lower).
        const { data } = await supabase
          .from('channels').select('*')
          .ilike('invite_code', code).maybeSingle()
        if (!data) { setNotFound(true); return }
        setChannel(data)
      } catch {
        setNotFound(true)
      } finally {
        clearTimeout(safetyTimer)
        setLoading(false)
      }
    }

    fetchChannel()
  }, [code])

  useEffect(() => {
    if (user && channel) {
      navigate(`/dashboard?canal=${code}`)
    }
  }, [user, channel])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '12px' }}><AppIcon name="loading" size={32} /></div>
        <div>Cargando canal...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '16px' }}><AppIcon name="lock" size={48} /></div>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Canal no encontrado</div>
        <div style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>El enlace de invitación no es válido.</div>
        <button onClick={() => navigate('/')}
          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700 }}>
          Volver al inicio
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}><AppIcon name="canales" size={48} /></div>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>#{channel.name}</div>
        {channel.description && <div style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>{channel.description}</div>}
        {channel.is_private && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><AppIcon name="lock" size={12} /> Canal privado</div>}
        <div style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          Inicia sesión para unirte a este canal
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button onClick={() => navigate(`/login?redirect=/canal/${code}`)}
            style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700 }}>
            Iniciar sesión
          </button>
          <button onClick={() => navigate(`/register?redirect=/canal/${code}`)}
            style={{ background: 'transparent', color: 'var(--color-text)', border: '0.5px solid var(--color-border)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>
            Registrarse
          </button>
        </div>
      </div>
    </div>
  )
}