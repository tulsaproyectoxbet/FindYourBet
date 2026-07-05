import { createClient } from '@supabase/supabase-js'
import { limiters, checkLimit } from './_ratelimit.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function welcomeEmailHtml({ username, confirmLink }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:#0F6E56;padding:28px 40px;text-align:center;">
          <div style="color:#fff;font-size:24px;font-weight:900;letter-spacing:-0.5px;">FindYourBet</div>
          <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:4px;">La red social de pronósticos transparentes</div>
        </td></tr>
        <tr><td style="padding:36px 40px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:20px;color:#111;font-weight:700;">¡Bienvenido/a, @${username}!</p>
          <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.75;">
            Tu cuenta está casi lista. Solo necesitas confirmar tu dirección de email para activarla.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${confirmLink}" style="display:inline-block;background:#0F6E56;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:16px 48px;border-radius:10px;">
                Confirmar mi cuenta →
              </a>
            </td></tr>
          </table>
          <div style="border-top:1px solid #eee;margin:24px 0;"></div>
          <div style="text-align:left;display:flex;flex-direction:column;gap:8px;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;">¿Qué puedes hacer en FYB?</p>
            <p style="margin:0 0 6px;font-size:13px;color:#555;">📊 Registra tus picks antes del partido — historial inmutable y público.</p>
            <p style="margin:0 0 6px;font-size:13px;color:#555;">🏆 Sigue a los mejores tipsters y accede a sus canales VIP.</p>
            <p style="margin:0 0 6px;font-size:13px;color:#555;">💬 Comparte análisis, comenta y conecta con la comunidad.</p>
          </div>
          <div style="margin-top:24px;background:#fff8e6;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;text-align:left;">
            <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
              ⏱ El enlace de confirmación caduca en <strong>24 horas</strong>. Si no lo usas, podrás solicitar uno nuevo desde la pantalla de inicio de sesión.
            </p>
          </div>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            ¿No creaste esta cuenta? Ignora este email.
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

  if (await checkLimit(limiters.register, req, res)) return

  const { name, surname, birthdate, nationality, username, email, password } = req.body || {}

  if (!name || !surname || !birthdate || !username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }

  const desiredUsername = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(desiredUsername)) {
    return res.status(400).json({ error: 'El usuario solo puede contener letras, números y _ (3-20 caracteres)' })
  }

  try {
    // Comprova unicitat del username
    const { data: existingProfile } = await supabase
      .from('profiles').select('id').ilike('username', desiredUsername).maybeSingle()
    if (existingProfile) {
      return res.status(400).json({ error: 'Este username ya está en uso. Elige otro.' })
    }

    // Crea l'usuari sense que Supabase enviï cap email automàtic
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: false,
      user_metadata: { name: name.trim(), surname, birthdate, nationality },
    })

    if (createError) {
      if (createError.message?.toLowerCase().includes('already')) {
        return res.status(400).json({ error: 'Este email ya está registrado. ¿Quizás ya tienes una cuenta?' })
      }
      return res.status(400).json({ error: createError.message || 'Error al crear la cuenta' })
    }

    // Crea el perfil
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: user.id,
      username: desiredUsername,
      name: name.trim(),
      username_changed_at: new Date().toISOString(),
    })

    if (profileErr) {
      // Si el perfil falla, elimina l'usuari per no deixar registres orfes
      await supabase.auth.admin.deleteUser(user.id).catch(() => {})
      console.error('[register] profile insert error:', profileErr.message)
      return res.status(500).json({ error: 'Error al guardar el perfil. Inténtalo de nuevo.' })
    }

    // Genera el link de confirmació (IMPORTANT: afegir /dashboard als "Redirect URLs" de Supabase)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { redirectTo: `${process.env.APP_URL}/dashboard` },
    })

    if (linkError) {
      console.error('[register] generateLink error:', linkError.message)
      return res.status(201).json({ ok: true, emailSent: false })
    }

    // Envia el welcome email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FindYourBet <noreply@fyourbet.com>',
        to: [email.trim().toLowerCase()],
        subject: '¡Bienvenido/a a FindYourBet! Confirma tu cuenta',
        html: welcomeEmailHtml({ username: desiredUsername, confirmLink: linkData.properties.action_link }),
      }),
    })

    if (!emailRes.ok) {
      console.error('[register] Resend error:', await emailRes.text())
    }

    return res.status(201).json({ ok: true, emailSent: true })
  } catch (e) {
    console.error('[register] unexpected error:', e.message)
    return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' })
  }
}
