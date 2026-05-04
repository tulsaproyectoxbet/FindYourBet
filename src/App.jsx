import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Landing from './features/landing/Landing'
import Login from './features/auth/Login'
import Register from './features/auth/Register'
import Dashboard from './features/dashboard/Dashboard'
import CanalPage from './features/dashboard/canales/CanalPage'
import { supabase } from './lib/supabase'

function AppRoutes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Carrega la sessió automàticament al iniciar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          email: session.user.email,
        })
      }
      setLoading(false)
    })

    // Escolta canvis de sessió
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          email: session.user.email,
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = (userData) => {
    setUser(userData)
    const params = new URLSearchParams(window.location.search)
    const redirect = params.get('redirect')
    navigate(redirect || '/dashboard')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ fontSize: '32px' }}>⏳</div>
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<Landing navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} user={user} />} />
      <Route path="/login" element={<Login navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} login={login} />} />
      <Route path="/register" element={<Register navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} login={login} />} />
      <Route path="/dashboard" element={user ? <Dashboard navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} user={user} logout={logout} /> : <Navigate to="/" />} />
      <Route path="/canal/:code" element={<CanalPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}