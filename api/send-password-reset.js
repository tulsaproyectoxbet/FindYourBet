import { createClient } from '@supabase/supabase-js'
import { limiters, checkLimit, getIp } from './_ratelimit.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function resetEmailHtml(resetLink) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:#0F6E56;padding:28px 40px;text-align:center;">
          <div style="color:#fff;font-size:24px;font-weight:900;letter-spacing:-0.5px;">FindYourBet</div>
        </td></tr>
        <tr><td style="padding:36px 40px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:16px;color:#333;font-weight:600;">Restablecer contraseña</p>
          <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.7;">
            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de FindYourBet.<br>
            Si no fuiste tú, puedes ignorar este mensaje.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${resetLink}" style="display:inline-block;background:#0F6E56;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 48px;border-radius:10px;">
                Cambiar contraseña →
              </a>
            </td></tr>
          </table>
          <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 16px;text-align:left;margin-bottom:20px;">
            <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
              ⏱ Este enlace caduca en <strong>1 hora</strong>. Si caduca, vuelve a solicitar el restablecimiento desde la pantalla de inicio de sesión.
            </p>
          </div>
          <p style="margin:0;font-size:12px;color:#aaa;">
            O copia este enlace en tu navegador:<br>
            <span style="color:#0F6E56;word-break:break-all;">${resetLink}</span>
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            ¿Problemas? Escríbenos a <a href="mailto:fyourbet@gmail.com" style="color:#0F6E56;">fyourbet@gmail.com</a>
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#ccc;">FindYourBet · fyourbet.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (await checkLimit(limiters.passwordReset, req, res)) return

  const { email } = req.body || {}
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email requerido' })
  }

  // Sempre retornem ok per no revelar si l'email existeix o no
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        // IMPORTANT: afegir /reset-password als "Redirect URLs" al dashboard de Supabase
        redirectTo: `${process.env.APP_URL}/reset-password`,
      },
    })

    if (error) {
      console.error('[send-password-reset] generateLink error:', error.message)
      return res.json({ ok: true })
    }

    const resetLink = data.properties.action_link

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FindYourBet <noreply@fyourbet.com>',
        to: [email.trim().toLowerCase()],
        subject: 'Restablece tu contraseña — FindYourBet',
        html: resetEmailHtml(resetLink),
      }),
    })

    if (!emailRes.ok) {
      console.error('[send-password-reset] Resend error:', await emailRes.text())
    }
  } catch (e) {
    console.error('[send-password-reset] error:', e.message)
  }

  return res.json({ ok: true })
}
