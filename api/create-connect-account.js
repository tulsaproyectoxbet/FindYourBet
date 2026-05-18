import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

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
    const { user_id, return_url, refresh_url } = await readBody(req)

    const { data: existing } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id, onboarded')
      .eq('user_id', user_id)
      .maybeSingle()

    let accountId = existing?.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'express', country: 'ES', business_profile: { url: 'https://fyourbet.com' } })
      accountId = account.id
      await supabase.from('stripe_accounts').insert({ user_id, stripe_account_id: accountId })
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url,
      return_url,
      type: 'account_onboarding',
    })

    res.json({ url: accountLink.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
