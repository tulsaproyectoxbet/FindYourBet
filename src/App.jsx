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
import LegalPage from './features/legal/LegalPage'
import InfoPage from './features/info/InfoPage'
import ContactPage from './features/info/ContactPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import CookieConsent from './components/CookieConsent'
import AppIcon from './components/ui/AppIcon'
import { supabase } from './lib/supabase'

function AppRoutes() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
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

  // Comprova si l'usuari està a la llista negra. Si ho està, força logout.
  // Via RPC SECURITY DEFINER `check_my_ban` (mira auth.email() internament): la taula
  // banned_emails ja no és llegible pel client, així no s'exposa la llista d'emails banejats.
  const checkBannedAndLogout = async (email) => {
    if (!email) return false
    const { data } = await supabase.rpc('check_my_ban')
    if (data && data.length > 0) {
      const reason = data[0].reason
      await supabase.auth.signOut()
      alert(`Tu cuenta ha sido bloqueada.${reason ? `\n\nMotivo: ${reason}` : ''}`)
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
      // INITIAL_SESSION ja el gestiona getSession; TOKEN_REFRESHED és silenciós.
      // PASSWORD_RECOVERY el gestiona ResetPasswordPage amb el seu propi listener.
      if (_event === 'INITIAL_SESSION' || _event === 'TOKEN_REFRESHED' || _event === 'PASSWORD_RECOVERY') return
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
          // Si el perfil no s'ha pogut carregar (username null), conservem el que ja teníem.
          // CRÍTIC: si les dades essencials no canvien, retornem la mateixa referència.
          // Així evitem que els components amb deps [user] facin refetch innecessàriament
          // a cada esdeveniment de Supabase (SIGNED_IN, USER_UPDATED, etc.).
          setUser(prev => {
            const next = {
              ...built,
              username: built.username ?? prev?.username ?? null,
              name: built.username ? built.name : (prev?.name ?? built.name),
              avatar_url: built.avatar_url ?? prev?.avatar_url ?? null,
            }
            if (prev
              && prev.id === next.id
              && prev.username === next.username
              && prev.email === next.email
              && prev.avatar_url === next.avatar_url
              && prev.is_verified === next.is_verified
              && prev.banned === next.banned
              && prev.needsOnboarding === next.needsOnboarding) {
              return prev
            }
            return next
          })
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
      <AppIcon name="loading" size={32} />
    </div>
  )

  const path = window.location.pathname

  return (
    <>
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
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/legal" element={<Navigate to="/legal/aviso-legal" replace />} />
      <Route path="/legal/:doc" element={<LegalPage />} />
      <Route path="/info" element={<Navigate to="/info/como-funciona" replace />} />
      <Route path="/info/:doc" element={<InfoPage />} />
      <Route path="/contacto" element={<ContactPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    {/* Banner de cookies — no cal a les pàgines legals (ja informen elles mateixes) */}
    {!path.startsWith('/legal') && !path.startsWith('/info') && path !== '/contacto' && <CookieConsent />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}