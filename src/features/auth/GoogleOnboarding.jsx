import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp } from '../../lib/animations'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import './auth.css'

const NATIONALITIES = ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Otra']

const maxBirthdate = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
  .toISOString().split('T')[0]

export default function GoogleOnboarding({ user, onComplete }) {
  const [username, setUsername] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [nationality, setNationality] = useState('')
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = username.trim().toLowerCase().replace('@', '')
    if (!trimmed) { setError('Elige un nombre de usuario'); return }
    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) { setError('El usuario solo puede contener letras, números y _ (3-20 caracteres)'); return }
    if (!birthdate) { setError('Introduce tu fecha de nacimiento'); return }
    const birth = new Date(birthdate)
    const ageDiff = new Date().getFullYear() - birth.getFullYear()
    if (ageDiff < 18) { setError('Debes ser mayor de 18 años para usar FYB'); return }
    if (!age) { setError('Debes confirmar que tienes 18 años o más'); return }
    if (!terms) { setError('Debes aceptar los Términos y la Política de Privacidad'); return }

    setError('')
    setLoading(true)

    const { data: existing } = await supabase
      .from('profiles').select('id').ilike('username', trimmed).maybeSingle()
    if (existing) {
      setError('Este username ya está en uso. Elige otro.')
      setLoading(false)
      return
    }

    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: user.id,
      username: trimmed,
      name: user.name || '',
      avatar_url: user.avatar_url || null,
      username_changed_at: new Date().toISOString(),
    })

    if (upsertErr) {
      setError('Error al guardar el perfil. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    await onComplete()
  }

  return (
    <div className="auth-page">
      <motion.nav className="auth-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="auth-logo">FindYour<span>Bet</span></div>
      </motion.nav>

      <div className="auth-wrapper">
        <motion.div className="auth-card" variants={fadeUp} initial="hidden" animate="visible">

          <motion.div variants={fadeUp} custom={1}>
            {user.avatar_url && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img src={user.avatar_url} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', border: '3px solid var(--color-primary-light)', objectFit: 'cover' }} />
              </div>
            )}
            <div className="auth-card-logo">Casi listo</div>
            <div className="auth-subtitle">
              Solo necesitamos un par de datos más para completar tu cuenta.
            </div>
          </motion.div>

          {error && (
            <motion.div className="auth-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.div>
          )}

          <motion.div className="form-group" variants={fadeUp} custom={2}>
            <FormLabel>Nombre de usuario *</FormLabel>
            <div className="input-with-icon">
              <span className="input-prefix">@</span>
              <Input
                className="has-prefix"
                placeholder="tuusuario"
                value={username}
                onChange={e => setUsername(e.target.value.replace('@', '').replace(/[^a-z0-9_]/gi, '').toLowerCase())}
                maxLength={20}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Solo letras, números y _ · 3-20 caracteres
            </div>
          </motion.div>

          <motion.div className="form-group" variants={fadeUp} custom={3}>
            <FormLabel>Fecha de nacimiento *</FormLabel>
            <Input
              type="date"
              value={birthdate}
              max={maxBirthdate}
              onChange={e => setBirthdate(e.target.value)}
            />
          </motion.div>

          <motion.div className="form-group" variants={fadeUp} custom={4}>
            <FormLabel>Nacionalidad</FormLabel>
            <select className="input" value={nationality} onChange={e => setNationality(e.target.value)}>
              <option value="">Seleccionar...</option>
              {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
            </select>
          </motion.div>

          <motion.div className="auth-checkboxes" variants={fadeUp} custom={5}>
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

          <motion.div variants={fadeUp} custom={6}>
            <Button full onClick={handleSubmit} disabled={loading}>
              {loading ? 'Guardando...' : 'Completar registro'}
            </Button>
          </motion.div>

          <motion.div className="auth-privacy-note" variants={fadeUp} custom={7}>
            🔒 Tus datos están protegidos y nunca serán compartidos con terceros.
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
