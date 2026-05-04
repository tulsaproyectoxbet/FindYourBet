import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/animations'
import { useSignUp } from './hooks/useSignUp'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import './auth.css'

const NATIONALITIES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Otra']

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

          {error && (
            <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.div>
          )}

          <motion.div className="form-row" variants={fadeUp} custom={2}>
            <div>
              <FormLabel>Nombre *</FormLabel>
              <Input placeholder="Tu nombre" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <FormLabel>Apellidos *</FormLabel>
              <Input placeholder="Tus apellidos" value={form.surname} onChange={e => update('surname', e.target.value)} />
            </div>
          </motion.div>

          <motion.div className="form-row" variants={fadeUp} custom={3}>
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

          <motion.div className="form-group" variants={fadeUp} custom={4}>
            <FormLabel>Nombre de usuario *</FormLabel>
            <div className="input-with-icon">
              <span className="input-prefix">@</span>
              <Input className="has-prefix" placeholder="tuusuario"
                value={form.user} onChange={e => update('user', e.target.value.replace('@', ''))} />
            </div>
          </motion.div>

          <motion.div className="form-group" variants={fadeUp} custom={5}>
            <FormLabel>Email *</FormLabel>
            <Input type="email" placeholder="tu@email.com"
              value={form.email} onChange={e => update('email', e.target.value)} />
          </motion.div>

          <motion.div className="form-row" variants={fadeUp} custom={6}>
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

          <motion.div className="auth-checkboxes" variants={fadeUp} custom={7}>
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

          <motion.div variants={fadeUp} custom={8}>
            <Button full onClick={handleRegister} disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </motion.div>

          <motion.div className="auth-privacy-note" variants={fadeUp} custom={9}>
            🔒 Tus datos están protegidos y nunca serán compartidos con terceros.
          </motion.div>

          <motion.div className="auth-switch" variants={fadeUp} custom={10}>
            ¿Ya tienes cuenta?{' '}
            <button className="auth-link" onClick={() => navigate('login')}>Inicia sesión</button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}