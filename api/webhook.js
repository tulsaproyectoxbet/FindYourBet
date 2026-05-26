import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Imprescindible: Vercel no ha de parsejar el body perquè Stripe necessita els bytes originals per verificar la signatura
export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

// Envia l'email d'accés al canal via Resend
async function sendAccessEmail({ to, channelName, tipsterUsername, offerName, accessLink, inviteCode, purchaseDate }) {
  if (!process.env.BREVO_API_KEY) {
    console.log('[sendAccessEmail] BREVO_API_KEY no configurat, email omès')
    return
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0F6E56;padding:28px 40px;text-align:center;">
          <div style="color:#ffffff;font-size:24px;font-weight:900;letter-spacing:-0.5px;">FindYourBet</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:16px;color:#333;">Hola,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
            Se ha completado tu compra de <strong style="color:#111;">${offerName || channelName}</strong>${offerName ? ` | Canal <strong style="color:#111;">${channelName}</strong>` : ''}
            el día <strong style="color:#111;">${purchaseDate}</strong>.
            Estos son los detalles de tu compra a <strong style="color:#111;">@${tipsterUsername}</strong>.
          </p>

          <!-- Separador -->
          <div style="border-top:1px solid #eee;margin-bottom:28px;"></div>

          <!-- Enlace destacat -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px;">
            Enlace de ACCESO A TU COMPRA
          </div>
          <div style="font-size:22px;font-weight:800;margin-bottom:20px;">
            &gt;&gt;&nbsp;
            <a href="${accessLink}" style="color:#0F6E56;text-decoration:underline;word-break:break-all;">
              ${accessLink}
            </a>
            &nbsp;&lt;&lt;
          </div>

          <!-- Botó CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${accessLink}" style="display:inline-block;background:#0F6E56;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 48px;border-radius:10px;">
                Acceder al canal →
              </a>
            </td></tr>
          </table>

          <!-- Separador -->
          <div style="border-top:1px solid #eee;margin-bottom:24px;"></div>

          <!-- Codi alternatiu -->
          <p style="margin:0 0 6px;font-size:13px;color:#888;">O únete manualmente con el código:</p>
          <div style="font-family:monospace;font-size:22px;font-weight:900;color:#111;letter-spacing:5px;margin-bottom:6px;">
            ${inviteCode.toUpperCase()}
          </div>
          <p style="margin:0 0 20px;font-size:12px;color:#aaa;">FindYourBet → Canales → busca el código en la barra de búsqueda</p>

          <!-- Avís personal -->
          <div style="background:#fff8e6;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;text-align:left;">
            <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
              ⚠️ <strong>Enlace personal:</strong> este acceso es exclusivo para tu cuenta de FindYourBet. No lo compartas.
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            Si tienes algún problema, escríbenos a <a href="mailto:fyourbet@gmail.com" style="color:#0F6E56;">fyourbet@gmail.com</a>
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#ccc;">FindYourBet · fyourbet.com</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'FindYourBet', email: 'fyourbet@gmail.com' },
      to: [{ email: to }],
      subject: `Tu acceso al canal ${channelName} - FindYourBet`,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[sendAccessEmail] Resend error:', err)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.payment_status !== 'paid') return res.json({ received: true })

    const { offer_id, user_id, channel_id } = session.metadata

    // Idempotency: skip if already processed
    const { data: existing } = await supabase
      .from('purchases')
      .select('id, token')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    let token = existing?.token

    if (!existing) {
      token = randomUUID()

      await supabase.from('purchases').insert({
        user_id,
        offer_id,
        channel_id,
        token,
        stripe_session_id: session.id,
        amount: session.amount_total,
      })

      await supabase.from('channel_members').upsert(
        { channel_id, user_id, role: 'member' },
        { onConflict: 'channel_id,user_id' }
      )

      // Obtenir email de l'usuari + info del canal + tipster per enviar l'email
      try {
        const [
          { data: { user: authUser } },
          { data: channelData },
          { data: offerData },
        ] = await Promise.all([
          supabase.auth.admin.getUserById(user_id),
          supabase.from('channels').select('name, invite_code, owner_id').eq('id', channel_id).single(),
          supabase.from('offers').select('name').eq('id', offer_id).single(),
        ])

        const { data: tipsterProfile } = await supabase
          .from('profiles').select('username').eq('id', channelData.owner_id).single()

        const appUrl = process.env.APP_URL || 'https://fyourbet.com'

        const date = new Date(session.created * 1000)
        const purchaseDate = date.toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
        })

        await sendAccessEmail({
          to: authUser?.email,
          channelName: channelData.name,
          tipsterUsername: tipsterProfile?.username || 'el tipster',
          offerName: offerData?.name,
          accessLink: `${appUrl}/acceso/${token}`,
          inviteCode: channelData.invite_code,
          purchaseDate,
        })
      } catch (emailErr) {
        // L'email mai bloqueja el flux principal de pagament
        console.error('[webhook] Error enviant email:', emailErr)
      }
    }
  }

  res.json({ received: true })
}
