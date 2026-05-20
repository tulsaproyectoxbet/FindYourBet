import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

export function useSignIn({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  const handleLogin = async () => {
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
    if (authError) { setError('Email o contraseña incorrectos'); return }
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
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
    exitResetSent: () => { setResetMode(false); setResetSent(false); setError('') }
  }
}
