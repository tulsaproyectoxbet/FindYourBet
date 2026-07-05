import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

export default function OfferPage({ user }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cancelled = searchParams.get('cancelled') === 'true'

  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [alreadyBought, setAlreadyBought] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('offers')
        .select('*, channels(name, description, avatar_url, invite_code, owner_id)')
        .eq('id', id)
        .maybeSingle()

      if (!data || !data.active) { setLoading(false); return }
      setOffer(data)

      if (user) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('offer_id', id)
          .maybeSingle()
        setAlreadyBought(!!purchase)
      }

      setLoading(false)
    }
    load()
  }, [id, user])

  const handleBuy = async () => {
    if (!user) {
      navigate(`/login?redirect=/oferta/${id}`)
      return
    }
    setPaying(true)
    setError('')
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: id, user_id: user.id }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setPaying(false); return }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setPaying(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <AppIcon name="loading" size={32} />
    </div>
  )

  if (!offer) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <AppIcon name="search" size={48} />
      <div style={{ fontSize: '18px', fontWeight: 700 }}>Oferta no encontrada</div>
      <button onClick={() => navigate('/')} style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '10px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
        Ir al inicio
      </button>
    </div>
  )

  const ch = offer.channels
  const initial = (ch?.name || '?')[0].toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Logo FYB */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '2px', textTransform: 'uppercase' }}>FindYourBet</span>
        </div>

        {/* Banner cancelled */}
        {cancelled && (
          <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--color-error)', textAlign: 'center' }}>
            Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
          </div>
        )}

        {/* Card del canal */}
        <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header canal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
              {ch?.avatar_url ? <img src={ch.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-text)' }}>{ch?.name}</div>
              {ch?.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{ch.description}</div>}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid var(--color-border)' }} />

          {/* Oferta */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Oferta de acceso</div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text)', marginBottom: '4px' }}>{offer.name}</div>
            {offer.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{offer.description}</div>}
          </div>

          {/* Preu */}
          <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Precio</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1.2 }}>{formatPrice(offer.price)}</div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right', lineHeight: 1.5 }}>
              Acceso permanente<br />hasta que el canal exista
            </div>
          </div>

          {/* Botó */}
          {alreadyBought ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700 }}>
                <AppIcon name="check" size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} /> Ya tienes acceso a este canal
              </div>
              <button onClick={() => navigate(`/dashboard`)} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', padding: '12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                Ir al dashboard →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Avís de correu — clau per evitar problemes d'accés post-compra */}
              {user ? (
                <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AppIcon name="warning" size={14} color="var(--color-warning, #f59e0b)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Estás comprando con la cuenta <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>. El enlace de acceso quedará vinculado a este email — asegúrate de que es el correcto.
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AppIcon name="warning" size={14} color="var(--color-warning, #f59e0b)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Usa el mismo email en FindYourBet y en el pago. Si no coinciden, no podrás acceder con tu enlace personal.
                  </div>
                </div>
              )}
              {error && (
                <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '13px', color: 'var(--color-error)', textAlign: 'center' }}>
                  {error}
                </div>
              )}
              <button onClick={handleBuy} disabled={paying} style={{ background: paying ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: paying ? 'var(--color-text-muted)' : '#010906', border: 'none', padding: '14px', borderRadius: 'var(--radius-md)', cursor: paying ? 'default' : 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                {paying ? 'Redirigiendo a Stripe...' : user ? `Comprar por ${formatPrice(offer.price)}` : 'Inicia sesión para comprar'}
              </button>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                <AppIcon name="lock" size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Pago seguro con Stripe · Sin suscripción automática
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          ¿No tienes cuenta? <span onClick={() => navigate(`/register?redirect=/oferta/${id}`)} style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>Regístrate gratis</span>
        </div>
      </div>
    </div>
  )
}
