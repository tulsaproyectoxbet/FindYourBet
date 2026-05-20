import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/animations'
import { useSignIn } from './hooks/useSignIn'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import { supabase } from '../../lib/supabase'
import './auth.css'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

const handleGoogleLogin = () => {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard' }
  })
}

export default function Login({ navigate, login }) {
  const {
    email, setEmail, pass, setPass, showPass, setShowPass,
    error, loading, resetSent, resetMode,
    handleLogin, handleResetPassword, skipDev,
    enterReset, exitReset, exitResetSent
  } = useSignIn({ onLogin: login })

  return (
    <div className="auth-page">
      <motion.nav className="auth-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="auth-logo" onClick={() => navigate('landing')}>FindYour<span>Bet</span></div>
        <Button variant="outline" size="sm" onClick={skipDev}>⚡ Saltar (dev)</Button>
      </motion.nav>

      <div className="auth-wrapper">
        <motion.div className="auth-card" variants={fadeUp} initial="hidden" animate="visible">

          {!resetMode && !resetSent && (
            <>
              <motion.div variants={fadeUp} custom={1}>
                <div className="auth-card-logo">FindYour<span>Bet</span></div>
                <div className="auth-subtitle">Bienvenido de nuevo</div>
              </motion.div>

              <motion.div variants={fadeUp} custom={2}>
                <button className="auth-google-btn" onClick={handleGoogleLogin}>
                  <GoogleIcon />
                  Continuar con Google
                </button>
                <div className="auth-divider">o continúa con email</div>
              </motion.div>

              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.div>
              )}

              <motion.div className="form-group" variants={fadeUp} custom={3}>
                <FormLabel>Email</FormLabel>
                <Input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </motion.div>

              <motion.div className="form-group" variants={fadeUp} custom={4}>
                <FormLabel>Contraseña</FormLabel>
                <div className="input-with-icon">
                  <Input type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={pass} onChange={e => setPass(e.target.value)} />
                  <button className="toggle-pass" onClick={() => setShowPass(v => !v)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} custom={5} style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button className="auth-link" onClick={enterReset}>¿Olvidaste tu contraseña?</button>
              </motion.div>

              <motion.div variants={fadeUp} custom={6}>
                <Button full onClick={handleLogin} disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </motion.div>

              <motion.div className="auth-switch" variants={fadeUp} custom={7}>
                ¿No tienes cuenta?{' '}
                <button className="auth-link" onClick={() => navigate('register')}>Regístrate gratis</button>
              </motion.div>
            </>
          )}

          {resetMode && !resetSent && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="auth-card-logo">FindYour<span>Bet</span></div>
              <div className="auth-subtitle">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </div>

              {error && <div className="auth-error">{error}</div>}

              <div className="form-group">
                <FormLabel>Email</FormLabel>
                <Input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <Button full onClick={handleResetPassword} disabled={loading} style={{ marginBottom: '16px' }}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </Button>

              <div className="auth-switch">
                <button className="auth-link" onClick={exitReset}>← Volver al login</button>
              </div>
            </motion.div>
          )}

          {resetSent && (
            <motion.div className="reset-success" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="reset-success-icon">📧</div>
              <div className="reset-success-title">Email enviado</div>
              <div className="reset-success-text">
                Hemos enviado un enlace a <strong>{email}</strong> para restablecer tu contraseña.
                Revisa tu bandeja de entrada.
              </div>
              <button className="auth-link" onClick={exitResetSent}>← Volver al login</button>
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  )
}