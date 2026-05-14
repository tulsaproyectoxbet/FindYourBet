import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

const EMPTY_FORM = {
  name: '', surname: '', birthdate: '', nationality: '',
  user: '', email: '', pass: '', passConfirm: ''
}

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

    const { data: existingUser } = await supabase
      .from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle()
    if (existingUser) {
      setError('Este @username ya está en uso. Elige otro.')
      setLoading(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { surname, birthdate, nationality } }
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }

    if (data.user?.id) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: username.toLowerCase(),
        name: '',
        username_changed_at: new Date().toISOString(),
      })
    }

    onLogin({ name: '', user: username, email, id: data.user?.id })
  }

  return {
    form, update, terms, setTerms, age, setAge,
    showPass, setShowPass, showPassConfirm, setShowPassConfirm,
    error, loading, handleRegister, skipDev
  }
}
