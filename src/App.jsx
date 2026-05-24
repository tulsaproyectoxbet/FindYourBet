import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Landing from './features/landing/Landing'
import Login from './features/auth/Login'
import Register from './features/auth/Register'
import GoogleOnboarding from './features/auth/GoogleOnboarding'
import Dashboard from './features/dashboard/Dashboard'
import CanalPage from './features/dashboard/canales/CanalPage'
import OfferPage from './features/dashboard/payments/OfferPage'
import PaymentSuccess from './features/dashboard/payments/PaymentSuccess'
import AccesoPage from './features/dashboard/payments/AccesoPage'
import { supabase } from './lib/supabase'

const SECRET_CODE = 'FYBM67'

function GateScreen({ onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = () => {
    if (code.trim().toUpperCase() === SECRET_CODE) {
      localStorage.setItem('fyb_unlocked', '1')
      onUnlock()
    } else {
      setError(true)
      setTimeout(() => setError(false), 1500)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: '#444', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Acceso restringido
        </div>
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(false) }}
          onKeyDown={handleKey}
          placeholder="Código de acceso"
          autoFocus
          style={{
            background: '#111',
            border: `1px solid ${error ? '#ff4444' : '#222'}`,
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '16px',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '4px',
            width: '220px',
            transition: 'border-color 0.2s',
            fontFamily: 'monospace'
          }}
        />
        {error && (
          <div style={{ fontSize: '12px', color: '#ff4444' }}>Código incorrecto</div>
        )}
        <button
          onClick={handleSubmit}
          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#666', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>
          Acceder
        </button>
      </div>
    </div>
  )
}

function AppRoutes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('fyb_unlocked') === '1')
  const navigate = useNavigate()

  const buildUser = async (authUser) => {
    let profile = null
    let profileConfirmed = false
    try {
      const res = await Promise.race([
        supabase.from('profiles').select('avatar_url, username, name, is_verified, banned, banned_reason').eq('id', authUser.id).maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('profile-timeout')), 6000))
      ])
      if (res?.error) {
        console.warn('[buildUser] profile query error:', res.error)
      } else {
        profileConfirmed = true
        profile = res?.data || null
      }
    } catch (e) {
      console.warn('[buildUser] profile fetch failed, falling back to metadata:', e?.message)
    }
    return {
      id: authUser.id,
      name: profile?.username || authUser.email,
      username: profile?.username || null,
      email: authUser.email,
      avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || null,
      is_verified: profile?.is_verified || false,
      banned: profile?.banned || false,
      banned_reason: profile?.banned_reason || null,
      // Si la query del perfil ha fallat (timeout, error, etc.) NO assumim que falti
      // l'onboarding — això causava redirects falsos en cada esdeveniment de Supabase.
      needsOnboarding: profileConfirmed && !profile?.username,
    }
  }

  // Comprova si un email està a la llista negra. Si ho està, força logout.
  const checkBannedAndLogout = async (email) => {
    if (!email) return false
    const { data } = await supabase.from('banned_emails').select('reason').eq('email', email.toLowerCase()).maybeSingle()
    if (data) {
      await supabase.auth.signOut()
      alert(`Tu cuenta ha sido bloqueada.${data.reason ? `\n\nMotivo: ${data.reason}` : ''}`)
      return true
    }
    return false
  }

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) setUser(await buildUser(session.user))
  }

  useEffect(() => {
    let timedOut = false
    // Si Supabase no respon en 5s, és que la sessió persisitida està corrompuda.
    // Netegem-la perquè el següent intent comenci de zero.
    const timeout = setTimeout(() => {
      timedOut = true
      Object.keys(localStorage)
        .filter(k => k.includes('supabase') || k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
      setLoading(false)
    }, 5000)

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (timedOut) return
        if (error) {
          await supabase.auth.signOut()
        } else if (session?.user) {
          // Comprova ban abans de construir l'usuari
          const banned = await checkBannedAndLogout(session.user.email)
          if (banned) return
          try {
            const built = await buildUser(session.user)
            if (built.banned) {
              await supabase.auth.signOut()
              alert(`Tu cuenta ha sido bloqueada.${built.banned_reason ? `\n\nMotivo: ${built.banned_reason}` : ''}`)
              return
            }
            setUser(built)
          } catch {
            setUser(prev => prev ?? { id: session.user.id, name: session.user.email, email: session.user.email, avatar_url: null })
          }
        }
      } catch {
        await supabase.auth.signOut()
      } finally {
        clearTimeout(timeout)
        if (!timedOut) setLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // INITIAL_SESSION ja el gestiona getSession; TOKEN_REFRESHED és silenciós i no
      // ha de re-avaluar needsOnboarding perquè pot arribar amb perfil incomplet.
      if (_event === 'INITIAL_SESSION' || _event === 'TOKEN_REFRESHED') return
      if (session?.user) {
        // Comprova ban (banned_emails table o profile.banned) i força logout si cal
        const banned = await checkBannedAndLogout(session.user.email)
        if (banned) return
        try {
          const built = await buildUser(session.user)
          if (built.banned) {
            await supabase.auth.signOut()
            alert(`Tu cuenta ha sido bloqueada.${built.banned_reason ? `\n\nMotivo: ${built.banned_reason}` : ''}`)
            return
          }
          // Si el perfil no s'ha pogut carregar (username null), conservem el que ja teníem
          setUser(prev => ({
            ...built,
            username: built.username ?? prev?.username ?? null,
            name: built.username ? built.name : (prev?.name ?? built.name),
            avatar_url: built.avatar_url ?? prev?.avatar_url ?? null,
          }))
        } catch {
          setUser(prev => prev ?? { id: session.user.id, name: session.user.email, email: session.user.email, avatar_url: null })
        }
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
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ])
    } catch {
      Object.keys(localStorage)
        .filter(k => k.includes('supabase') || k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
    }
    setUser(null)
    navigate('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ fontSize: '32px' }}>⏳</div>
    </div>
  )

  const isPublicRoute = window.location.pathname.startsWith('/oferta/') || window.location.pathname.startsWith('/payment/') || window.location.pathname.startsWith('/acceso/')
  if (!unlocked && !isPublicRoute) return <GateScreen onUnlock={() => setUnlocked(true)} />

  return (
    <Routes>
      <Route path="/" element={<Landing navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} user={user} />} />
      <Route path="/login" element={<Login navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} login={login} />} />
      <Route path="/register" element={<Register navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} login={login} />} />
      <Route path="/onboarding" element={user ? (user.needsOnboarding ? <GoogleOnboarding user={user} onComplete={refreshUser} /> : <Navigate to="/dashboard" />) : <Navigate to="/" />} />
      <Route path="/dashboard" element={user ? (user.needsOnboarding ? <Navigate to="/onboarding" /> : <Dashboard navigate={(page) => navigate(`/${page === 'landing' ? '' : page}`)} user={user} logout={logout} onRefreshUser={refreshUser} />) : <Navigate to="/" />} />
      <Route path="/canal/:code" element={<CanalPage />} />
      <Route path="/oferta/:id" element={<OfferPage user={user} />} />
      <Route path="/payment/success" element={<PaymentSuccess user={user} />} />
      <Route path="/acceso/:token" element={<AccesoPage user={user} />} />
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