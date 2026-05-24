import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Valida que un token de compra pertany a l'usuari que el reclama.
// Retorna la info del canal per mostrar la preview.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { token, user_id } = req.query
  if (!token || !user_id) return res.status(400).json({ error: 'Falten paràmetres' })

  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, channel_id, offer_id, channels(id, name, description, invite_code, owner_id), offers(name)')
    .eq('token', token)
    .eq('user_id', user_id)
    .maybeSingle()

  // Token inexistent o no pertany a aquest usuari
  if (!purchase) {
    return res.status(404).json({ error: 'Este enlace no es válido para tu cuenta' })
  }

  const { data: tipster } = await supabase
    .from('profiles')
    .select('username, avatar_url, is_verified')
    .eq('id', purchase.channels.owner_id)
    .single()

  return res.json({
    channel: {
      id: purchase.channels.id,
      name: purchase.channels.name,
      description: purchase.channels.description,
      invite_code: purchase.channels.invite_code,
    },
    offer: purchase.offers,
    tipster,
  })
}
