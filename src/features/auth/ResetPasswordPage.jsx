import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fadeUp } from '../../lib/animations'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import AppIcon from '../../components/ui/AppIcon'
import './auth.css'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  // 'loading' → esperant event de Supabase | 'ready' → mostra formulari | 'invalid' → link caducat | 'success' → contrasenya canviada
  const [status, setStatus] = useState('loading')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Si en 4s no arriba l'event PASSWORD_RECOVERY, el link és invàlid o ja s'ha usat
    const fallback = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'invalid' : prev)
    }, 4000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(fallback)
        setStatus('ready')
      }
    })

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async () => {
    if (!newPass || !confirmPass) { setError('Rellena los dos campos'); return }
    if (newPass !== confirmPass) { setError('Las contraseñas no coinciden'); return }
    if (newPass.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(newPass)) { setError('Debe contener al menos una mayúscula'); return }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]/.test(newPass)) {
      setError('Debe contener al menos un carácter especial'); return
    }

    setError('')
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPass })
    setLoading(false)

    if (updateError) {
      setError(updateError.message || 'Error al cambiar la contraseña. Inténtalo de nuevo.')
      return
    }

    setStatus('success')
    setTimeout(() => navigate('/dashboard'), 2500)
  }

  return (
    <div className="auth-page">
      <motion.nav className="auth-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="auth-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          FindYour<span>Bet</span>
        </div>
      </motion.nav>

      <div className="auth-wrapper">
        <motion.div className="auth-card" variants={fadeUp} initial="hidden" animate="visible">

          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <AppIcon name="loading" size={32} color="var(--color-primary)" />
              <div style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>Verificando enlace…</div>
            </div>
          )}

          {status === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-error-light, rgba(239,68,68,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AppIcon name="ban" size={26} color="var(--color-error)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Enlace inválido o caducado</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                Este enlace ya ha sido usado o ha caducado.<br />
                Solicita uno nuevo desde la pantalla de inicio de sesión.
              </div>
              <Button onClick={() => navigate('/login')}>Volver al login</Button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="auth-card-logo">FindYour<span>Bet</span></div>
              <div className="auth-subtitle">Elige una nueva contraseña para tu cuenta.</div>

              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.div>
              )}

              <div className="form-group">
                <FormLabel>Nueva contraseña</FormLabel>
                <div className="input-with-icon">
                  <Input type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                    value={newPass} onChange={e => setNewPass(e.target.value)} />
                  <button className="toggle-pass" onClick={() => setShowPass(v => !v)}>
                    <AppIcon name={showPass ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <FormLabel>Repetir contraseña</FormLabel>
                <Input type={showPass ? 'text' : 'password'} placeholder="Repite la contraseña"
                  value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
              </div>

              <Button full onClick={handleSubmit} disabled={loading}>
                {loading ? 'Guardando…' : 'Cambiar contraseña'}
              </Button>
            </>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-light)', border: '1.5px solid var(--color-primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AppIcon name="check" size={26} color="var(--color-primary)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>¡Contraseña actualizada!</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Redirigiendo al dashboard…</div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  )
}
