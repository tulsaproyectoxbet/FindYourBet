import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const FEE_STANDARD    = 0.20  // tipsters sense partnership
const FEE_PARTNERSHIP = 0.15  // tipsters verificats (partnership)

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString())
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { offer_id, user_id } = await readBody(req)

    const { data: offer } = await supabase
      .from('offers')
      .select('*, channels(invite_code, owner_id, name)')
      .eq('id', offer_id)
      .single()

    if (!offer || !offer.active) return res.status(404).json({ error: 'Oferta no encontrada' })

    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user_id)
      .eq('offer_id', offer_id)
      .maybeSingle()

    if (existing) return res.status(400).json({ error: 'Ya tienes acceso a este canal' })

    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', offer.channels.owner_id)
      .single()

    if (!stripeAccount?.stripe_account_id) {
      return res.status(400).json({ error: 'El tipster no tiene pagos configurados' })
    }

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', offer.channels.owner_id)
      .single()

    const feePercent = ownerProfile?.is_verified ? FEE_PARTNERSHIP : FEE_STANDARD
    const appFee = Math.round(offer.price * feePercent)
    const appUrl = process.env.APP_URL || 'https://fyourbet.com'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: offer.name,
            description: offer.description || `Acceso al canal ${offer.channels.name}`,
          },
          unit_amount: offer.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/oferta/${offer_id}?cancelled=true`,
      metadata: { offer_id, user_id, channel_id: offer.channel_id },
      payment_intent_data: {
        application_fee_amount: appFee,
        transfer_data: { destination: stripeAccount.stripe_account_id },
      },
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
