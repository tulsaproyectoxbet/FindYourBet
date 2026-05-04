import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/animations'
import { useSignIn } from './hooks/useSignIn'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import './auth.css'

export default function Login({ navigate, login }) {
  const {
    email, setEmail, pass, setPass, showPass, setShowPass,
    error, loading, resetSent, resetMode,
    handleLogin, handleResetPassword,
    enterReset, exitReset, exitResetSent
  } = useSignIn({ onLogin: login })

  return (
    <div className="auth-page">
      <motion.nav className="auth-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="auth-logo" onClick={() => navigate('landing')}>FindYour<span>Bet</span></div>
      </motion.nav>

      <div className="auth-wrapper">
        <motion.div className="auth-card" variants={fadeUp} initial="hidden" animate="visible">

          {!resetMode && !resetSent && (
            <>
              <motion.div variants={fadeUp} custom={1}>
                <div className="auth-card-logo">FindYour<span>Bet</span></div>
                <div className="auth-subtitle">Bienvenido de nuevo</div>
              </motion.div>

              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.div>
              )}

              <motion.div className="form-group" variants={fadeUp} custom={2}>
                <FormLabel>Email</FormLabel>
                <Input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </motion.div>

              <motion.div className="form-group" variants={fadeUp} custom={3}>
                <FormLabel>Contraseña</FormLabel>
                <div className="input-with-icon">
                  <Input type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={pass} onChange={e => setPass(e.target.value)} />
                  <button className="toggle-pass" onClick={() => setShowPass(v => !v)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} custom={4} style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button className="auth-link" onClick={enterReset}>¿Olvidaste tu contraseña?</button>
              </motion.div>

              <motion.div variants={fadeUp} custom={5}>
                <Button full onClick={handleLogin} disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </motion.div>

              <motion.div className="auth-switch" variants={fadeUp} custom={6}>
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