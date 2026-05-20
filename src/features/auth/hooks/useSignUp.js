import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

const EMPTY_FORM = {
  name: '', surname: '', birthdate: '', nationality: '',
  user: '', email: '', pass: '', passConfirm: ''
}

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms))
  ])

export function useSignUp({ onLogin }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [terms, setTerms] = useState(false)
  const [age, setAge] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  const skipDev = () =>
    onLogin({ name: 'Dev', surname: 'Test', user: 'devtest', email: 'dev@test.com', id: 'dev-skip' })

  const handleRegister = async () => {
    const { name, surname, birthdate, user: username, email, pass, passConfirm, nationality } = form
    if (!name || !surname || !birthdate || !username || !email || !pass || !passConfirm) {
      setError('Rellena todos los campos obligatorios'); return
    }
    if (pass !== passConfirm) { setError('Las contraseñas no coinciden'); return }
    if (pass.length < 8) { setError('La contraseña debe tener mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(pass)) { setError('La contraseña debe contener al menos una mayúscula'); return }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]/.test(pass)) {
      setError('La contraseña debe contener al menos un carácter especial (!@#$%...)'); return
    }
    const birth = new Date(birthdate)
    if (new Date().getFullYear() - birth.getFullYear() < 18) {
      setError('Debes ser mayor de 18 años'); return
    }
    if (!terms || !age) { setError('Debes aceptar los términos y confirmar tu edad'); return }

    setError('')
    setLoading(true)

    const desiredUsername = username.toLowerCase()

    try {
      const { data: existingUser, error: checkErr } = await withTimeout(
        supabase.from('profiles').select('id').ilike('username', desiredUsername).maybeSingle(),
        8000, 'username-check'
      )
      if (checkErr) throw checkErr
      if (existingUser) {
        setError('Este username ya está en uso. Elige otro.')
        setLoading(false)
        return
      }

      const { data, error: authError } = await withTimeout(
        supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { name: name.trim(), surname, birthdate, nationality } }
        }),
        10000, 'signUp'
      )
      if (authError) {
        setError(authError.message || 'Error al crear la cuenta')
        setLoading(false)
        return
      }

      if (!data.user?.id) {
        setError('No se pudo crear la cuenta. Inténtalo de nuevo.')
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('Cuenta creada. Revisa tu email para confirmar tu cuenta antes de iniciar sesión.')
        setLoading(false)
        return
      }

      const { error: profileErr } = await withTimeout(
        supabase.from('profiles').upsert({
          id: data.user.id,
          username: desiredUsername,
          name: name.trim(),
          username_changed_at: new Date().toISOString(),
        }),
        8000, 'profile-upsert'
      )
      if (profileErr) {
        setError('Error al guardar el perfil: ' + profileErr.message)
        setLoading(false)
        return
      }

      setLoading(false)
      onLogin({
        id: data.user.id,
        name: name.trim(),
        username: desiredUsername,
        email,
        avatar_url: null,
        needsOnboarding: false,
      })
    } catch (e) {
      console.error('[Register] Error:', e)
      setError('Error inesperado: ' + (e?.message || 'desconocido'))
      setLoading(false)
    }
  }

  return {
    form, update, terms, setTerms, age, setAge,
    showPass, setShowPass, showPassConfirm, setShowPassConfirm,
    error, loading, handleRegister, skipDev
  }
}
