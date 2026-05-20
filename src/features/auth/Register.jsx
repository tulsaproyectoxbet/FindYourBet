import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/animations'
import { useSignUp } from './hooks/useSignUp'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import { supabase } from '../../lib/supabase'
import './auth.css'

const NATIONALITIES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Otra']

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

const handleGoogleRegister = () => {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard' }
  })
}

export default function Register({ navigate, login }) {
  const {
    form, update, terms, setTerms, age, setAge,
    showPass, setShowPass, showPassConfirm, setShowPassConfirm,
    error, loading, handleRegister
  } = useSignUp({ onLogin: login })

  const maxBirthdate = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString().split('T')[0]

  return (
    <div className="auth-page">
      <motion.nav className="auth-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="auth-logo" onClick={() => navigate('landing')}>FindYour<span>Bet</span></div>
      </motion.nav>

      <div className="auth-wrapper">
        <motion.div className="auth-card auth-card--wide" variants={fadeUp} initial="hidden" animate="visible">
          <motion.div variants={fadeUp} custom={1}>
            <div className="auth-card-logo">FindYour<span>Bet</span></div>
            <div className="auth-subtitle">Crea tu cuenta — es gratis</div>
          </motion.div>

          <motion.div variants={fadeUp} custom={2}>
            <button className="auth-google-btn" onClick={handleGoogleRegister}>
              <GoogleIcon />
              Registrarse con Google
            </button>
            <div className="auth-divider">o regístrate con email</div>
          </motion.div>

          {error && (
            <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.div>
          )}

          <motion.div className="form-row" variants={fadeUp} custom={3}>
            <div>
              <FormLabel>Nombre *</FormLabel>
              <Input placeholder="Tu nombre" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <FormLabel>Apellidos *</FormLabel>
              <Input placeholder="Tus apellidos" value={form.surname} onChange={e => update('surname', e.target.value)} />
            </div>
          </motion.div>

          <motion.div className="form-row" variants={fadeUp} custom={4}>
            <div>
              <FormLabel>Fecha de nacimiento *</FormLabel>
              <Input type="date" value={form.birthdate} max={maxBirthdate}
                onChange={e => update('birthdate', e.target.value)} />
            </div>
            <div>
              <FormLabel>Nacionalidad</FormLabel>
              <select className="input" value={form.nationality} onChange={e => update('nationality', e.target.value)}>
                <option value="">Seleccionar...</option>
                {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </motion.div>

          <motion.div className="form-group" variants={fadeUp} custom={5}>
            <FormLabel>Nombre de usuario *</FormLabel>
            <div className="input-with-icon">
              <span className="input-prefix">@</span>
              <Input className="has-prefix" placeholder="tuusuario"
                value={form.user} onChange={e => update('user', e.target.value.replace('@', ''))} />
            </div>
          </motion.div>

          <motion.div className="form-group" variants={fadeUp} custom={6}>
            <FormLabel>Email *</FormLabel>
            <Input type="email" placeholder="tu@email.com"
              value={form.email} onChange={e => update('email', e.target.value)} />
          </motion.div>

          <motion.div className="form-row" variants={fadeUp} custom={7}>
            <div>
              <FormLabel>Contraseña *</FormLabel>
              <div className="input-with-icon">
                <Input type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                  value={form.pass} onChange={e => update('pass', e.target.value)} />
                <button className="toggle-pass" onClick={() => setShowPass(v => !v)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <FormLabel>Repetir contraseña *</FormLabel>
              <div className="input-with-icon">
                <Input type={showPassConfirm ? 'text' : 'password'} placeholder="Repite la contraseña"
                  value={form.passConfirm} onChange={e => update('passConfirm', e.target.value)} />
                <button className="toggle-pass" onClick={() => setShowPassConfirm(v => !v)}>
                  {showPassConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div className="auth-checkboxes" variants={fadeUp} custom={8}>
            <label className="auth-checkbox-label">
              <input type="checkbox" className="auth-checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
              <span>Confirmo que tengo <strong>18 años o más</strong> y que las apuestas están permitidas en mi país de residencia.</span>
            </label>
            <label className="auth-checkbox-label">
              <input type="checkbox" className="auth-checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
              <span>
                He leído y acepto los{' '}
                <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Términos y Condiciones</a>
                {' '}y la{' '}
                <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Política de Privacidad</a>.
              </span>
            </label>
          </motion.div>

          <motion.div variants={fadeUp} custom={9}>
            <Button full onClick={handleRegister} disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </motion.div>

          <motion.div className="auth-privacy-note" variants={fadeUp} custom={10}>
            🔒 Tus datos están protegidos y nunca serán compartidos con terceros.
          </motion.div>

          <motion.div className="auth-switch" variants={fadeUp} custom={11}>
            ¿Ya tienes cuenta?{' '}
            <button className="auth-link" onClick={() => navigate('login')}>Inicia sesión</button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
