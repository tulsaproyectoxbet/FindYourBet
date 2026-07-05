import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

const MAX_ATTEMPTS = 6
const STORAGE_KEY_ATTEMPTS = 'fyb_login_attempts'
const STORAGE_KEY_LOCKED   = 'fyb_login_locked_until'

// Temps de bloqueig per nombre d'intents fallits (en ms)
function lockDuration(attempts) {
  if (attempts >= 6) return 15 * 60 * 1000  // 15 min
  if (attempts === 5) return 2 * 60 * 1000   // 2 min
  if (attempts === 4) return 60 * 1000        // 1 min
  return 0  // primers 3 intents sense espera
}

function getStoredAttempts() {
  return parseInt(localStorage.getItem(STORAGE_KEY_ATTEMPTS) || '0', 10)
}

function getLockedUntil() {
  return parseInt(localStorage.getItem(STORAGE_KEY_LOCKED) || '0', 10)
}

export function useSignIn({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  const [failedAttempts, setFailedAttempts] = useState(getStoredAttempts)
  const [lockedUntil, setLockedUntil] = useState(getLockedUntil)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef(null)

  // Compte enrere visible mentre hi ha bloqueig actiu
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) clearInterval(timerRef.current)
    }
    tick()
    if (lockedUntil > Date.now()) {
      timerRef.current = setInterval(tick, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [lockedUntil])

  const isLocked = () => lockedUntil > Date.now()

  const handleLogin = async () => {
    if (isLocked()) return
    if (!email || !pass) { setError('Rellena todos los campos'); return }

    setError('')
    setLoading(true)
    let data, authError
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password: pass }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
      data = result.data
      authError = result.error
    } catch {
      Object.keys(localStorage)
        .filter(k => k.includes('supabase') || k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
      setLoading(false)
      setError('Sesión caducada. Vuelve a intentarlo.')
      return
    }
    setLoading(false)

    if (authError) {
      // Email no confirmat — missatge específic sense comptar com a intent fallit
      if (authError.message?.toLowerCase().includes('email not confirmed') ||
          authError.message?.toLowerCase().includes('not confirmed')) {
        setError('Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.')
        return
      }

      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, newAttempts)

      const duration = lockDuration(newAttempts)
      if (duration > 0) {
        const until = Date.now() + duration
        setLockedUntil(until)
        localStorage.setItem(STORAGE_KEY_LOCKED, until)
        const mins = Math.round(duration / 60000)
        setError(
          newAttempts >= MAX_ATTEMPTS
            ? `Demasiados intentos fallidos. Espera ${mins} minutos.`
            : `Contraseña incorrecta. Espera ${mins === 1 ? '1 minuto' : `${mins} minutos`} antes de volver a intentarlo.`
        )
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts
        setError(
          `Email o contraseña incorrectos. Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`
        )
      }
      return
    }

    // Login correcte → neteja comptadors
    localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
    localStorage.removeItem(STORAGE_KEY_LOCKED)
    const meta = data.user?.user_metadata
    onLogin({
      name: meta?.name || email.split('@')[0],
      surname: meta?.surname || '',
      user: meta?.username || '',
      email: data.user.email,
      id: data.user.id
    })
  }

  const handleResetPassword = async () => {
    if (!email) { setError('Introduce tu email primero'); return }
    setError('')
    setLoading(true)
    // Supabase gestiona l'enviament natiu — il·limitat, sense dependències externes
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setResetSent(true)
  }

  const skipDev = () =>
    onLogin({ name: 'Dev', surname: 'Test', user: 'devtest', email: 'dev@test.com', id: 'dev-skip' })

  return {
    email, setEmail, pass, setPass, showPass, setShowPass,
    error, loading, resetSent, resetMode,
    handleLogin, handleResetPassword, skipDev,
    enterReset: () => { setResetMode(true); setError('') },
    exitReset: () => { setResetMode(false); setError('') },
    exitResetSent: () => { setResetMode(false); setResetSent(false); setError('') },
    isLocked: isLocked(),
    secondsLeft,
    failedAttempts,
  }
}
