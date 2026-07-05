import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { MIN_ACCESS_PRICE } from '../../../lib/commission'
import { clampLines, LINE_LIMIT } from '../../../lib/textLimits'
import AppIcon from '../../../components/ui/AppIcon'

function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ padding: '5px 10px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: copied ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
      {copied ? <AppIcon name="check" size={13} /> : <AppIcon name="copy" size={13} />}
    </button>
  )
}

export default function OfferManager({ channelId, userId }) {
  const [stripeStatus, setStripeStatus] = useState(null) // null | { connected, onboarded }
  const [loadingStripe, setLoadingStripe] = useState(true)
  const [connectingStripe, setConnectingStripe] = useState(false)

  const [offers, setOffers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const appUrl = window.location.origin

  useEffect(() => {
    checkStripeStatus()
    fetchOffers()
  }, [])

  const checkStripeStatus = async () => {
    setLoadingStripe(true)
    try {
      const res = await fetch(`/api/check-account-status?user_id=${userId}`)
      const data = await res.json()
      setStripeStatus(data)
    } catch {
      setStripeStatus({ connected: false, onboarded: false })
    }
    setLoadingStripe(false)
  }

  const fetchOffers = async () => {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
    setOffers(data || [])
  }

  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    try {
      const res = await fetch('/api/create-connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          return_url: `${appUrl}/dashboard?stripe=connected`,
          refresh_url: `${appUrl}/dashboard?stripe=refresh`,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setConnectingStripe(false)
    }
  }

  const handleSaveOffer = async () => {
    if (!form.name.trim()) return setFormError('El nombre es obligatorio')
    const priceNum = parseFloat(form.price.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < MIN_ACCESS_PRICE) return setFormError(`El precio mínimo es ${MIN_ACCESS_PRICE} €`)
    setSaving(true)
    setFormError('')
    const { error } = await supabase.from('offers').insert({
      channel_id: channelId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Math.round(priceNum * 100),
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setForm({ name: '', description: '', price: '' })
    setShowForm(false)
    setSaving(false)
    fetchOffers()
  }

  const handleToggleOffer = async (offer) => {
    await supabase.from('offers').update({ active: !offer.active }).eq('id', offer.id)
    fetchOffers()
  }

  const handleDeleteOffer = async (id) => {
    await supabase.from('offers').delete().eq('id', id)
    fetchOffers()
  }

  const inputSt = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }

  if (loadingStripe) return <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0' }}>Comprobando Stripe...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Stripe Connect status */}
      {!stripeStatus?.onboarded ? (
        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', marginBottom: '4px' }}>
            {stripeStatus?.connected
              ? <><AppIcon name="clock" size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Verificación incompleta</>
              : <><AppIcon name="creditCard" size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Conecta Stripe para cobrar</>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
            {stripeStatus?.connected
              ? 'Completa el proceso de verificación de Stripe para activar los pagos.'
              : 'Necesitas conectar tu cuenta bancaria a través de Stripe para recibir pagos de los usuarios.'}
          </div>
          <button onClick={handleConnectStripe} disabled={connectingStripe} style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '9px 16px', borderRadius: 'var(--radius-md)', cursor: connectingStripe ? 'default' : 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
            {connectingStripe ? 'Redirigiendo...' : stripeStatus?.connected ? 'Completar verificación →' : 'Conectar con Stripe →'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
          <AppIcon name="check" size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} /> Stripe conectado y verificado
        </div>
      )}

      {/* Ofertes */}
      {stripeStatus?.onboarded && (
        <>
          {offers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {offers.map(offer => (
                <div key={offer.id} style={{ background: 'var(--color-bg)', border: `0.5px solid ${offer.active ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {offer.name}
                        <span style={{ fontSize: '11px', background: offer.active ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: offer.active ? 'var(--color-primary)' : 'var(--color-text-muted)', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                          {offer.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>{formatPrice(offer.price)}</div>
                      {offer.description && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{offer.description}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appUrl}/oferta/{offer.id}
                    </div>
                    <CopyButton text={`${appUrl}/oferta/${offer.id}`} />
                    <button onClick={() => handleToggleOffer(offer)} style={{ padding: '5px 8px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                      {offer.active ? 'Pausar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDeleteOffer(offer.id)} style={{ padding: '5px 8px', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                      <AppIcon name="delete" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulari nova oferta */}
          {showForm ? (
            <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>Nueva oferta</div>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre (ej: Pack fin de semana)" maxLength={60} style={inputSt} />
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: clampLines(e.target.value, LINE_LIMIT.FORM) }))} placeholder="Descripción (opcional)" rows={2} maxLength={300} style={{ ...inputSt, resize: 'none' }} />
              <div style={{ position: 'relative' }}>
                <input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0,00" style={{ ...inputSt, paddingRight: '30px' }} />
                <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--color-text-muted)' }}>€</span>
              </div>
              {formError && <div style={{ fontSize: '12px', color: 'var(--color-error)' }}>{formError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setShowForm(false); setFormError('') }} style={{ flex: 1, padding: '8px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveOffer} disabled={saving} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: '#010906', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Guardando...' : '+ Crear oferta'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '9px', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              + Nueva oferta de acceso
            </button>
          )}
        </>
      )}
    </div>
  )
}
