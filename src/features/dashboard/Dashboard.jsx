import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { usePolling } from '../../hooks/usePolling'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBets } from './hooks/useBets'
import { useUnreadDMCount } from './social/hooks/useUnreadDMCount'
import { useUnreadChannelCount } from '../../hooks/useUnreadChannelCount'
import { BetModal } from './BetModal'
import Estadisticas from './Estadisticas'
import Historial from './MisApuestas'
import Ranking from './Ranking'
import RankingAmigos from './RankingAmigos'
import Canales from './canales'
import Contacto from './Contacto'
import Social from './social'
import Tipsters from './tipsters'
import MiPerfil from './social/MiPerfil'
import Feed from './feed'
import ProfileView from './social/ProfileView'
import PostModal from './feed/PostModal'
import { useNotifications } from './notifications/useNotifications'
import NotificationsPanel from './notifications/NotificationsPanel'
import Configuracion from './Configuracion'
import Faqs from './Faqs'
// AdminPanel és pesant i només l'usa fyourbet — code-split per reduir el bundle inicial
const AdminPanel = lazy(() => import('../admin/AdminPanel'))
import Username from '../../components/ui/Username'
import Avatar from '../../components/ui/Avatar'
import { ProfileNavContext } from '../../contexts/ProfileNavContext'
import { AdminModeProvider } from '../../contexts/AdminModeContext'
import './dashboard.css'

const SHORTCUT_OPTIONS = [
  { id: 'miperfil',     label: 'Perfil',           icon: '👤' },
  { id: 'estadisticas', label: 'Estadísticas',      icon: '📊' },
  { id: 'historial',    label: 'Historial',         icon: '📋' },
  { id: 'feed',         label: 'Descubre',          icon: '🔥' },
  { id: 'canales',      label: 'Canales',           icon: '📡' },
  { id: 'tipsters',     label: 'Tipsters',          icon: '🎯' },
  { id: 'social',       label: 'Mensajes',          icon: '💬' },
  { id: 'ranking',      label: 'Ranking',           icon: '🏆' },
  { id: 'amigos',       label: 'Amigos',            icon: '👥' },
  { id: 'faqs',         label: 'FAQs',              icon: '❓' },
  { id: 'contacto',     label: 'Contacto',          icon: '📱' },
  { id: 'sugerencias',  label: 'Sugerencias',       icon: '💡' },
]

// Emails amb accés al panell d'admin — ha de coincidir amb ADMIN_EMAILS a AdminPanel.jsx
const ADMIN_EMAILS = ['fyourbet@gmail.com']

const DEFAULT_SHORTCUTS = ['estadisticas', 'social', 'ranking', 'contacto']
const MAX_SHORTCUTS = 5

const SIDEBAR = [
  {
    label: 'Mi perfil',
    items: [
      { id: 'miperfil', label: 'Perfil', icon: '👤' },
      { id: 'estadisticas', label: 'Estadísticas personales', icon: '📊' },
      { id: 'historial', label: 'Historial', icon: '📋' },
    ]
  },
  {
    label: 'Social',
    items: [
      { id: 'feed', label: 'Descubre', icon: '🔥' },
      { id: 'canales', label: 'Canales', icon: '📡' },
      { id: 'tipsters', label: 'Tipsters', icon: '🎯' },
      { id: 'social', label: 'Mensajes directos', icon: '💬' },
    ]
  },
  {
    label: 'Ranking',
    items: [
      { id: 'ranking', label: 'Ranking',  icon: '🏆' },
      { id: 'amigos',  label: 'Amigos',   icon: '👥' },
    ]
  },
  {
    label: 'Contacto',
    items: [
      { id: 'faqs', label: 'FAQs', icon: '❓' },
      { id: 'contacto', label: 'Redes sociales & Soporte', icon: '📱' },
      { id: 'sugerencias', label: 'Ayúdanos a mejorar', icon: '💡' },
    ]
  },
]

function ShortcutConfigModal({ shortcuts, onSave, onClose }) {
  const [selected, setSelected] = useState([...shortcuts])

  const toggle = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id))
    } else {
      if (selected.length >= MAX_SHORTCUTS) return
      setSelected([...selected, id])
    }
  }

  const move = (index, dir) => {
    const next = [...selected]
    const to = index + dir
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to], next[index]]
    setSelected(next)
  }

  const handleSave = () => { onSave(selected); onClose() }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: 'var(--shadow-md)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>Atajos de navegación</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>×</button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          Máximo {MAX_SHORTCUTS} atajos. Reordénalos con las flechas.
        </div>

        {/* Seleccionados */}
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Seleccionados ({selected.length}/{MAX_SHORTCUTS})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', minHeight: '48px' }}>
          {selected.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', textAlign: 'center', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              Ningún atajo seleccionado
            </div>
          )}
          {selected.map((id, i) => {
            const opt = SHORTCUT_OPTIONS.find(o => o.id === id)
            if (!opt) return null
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '15px' }}>{opt.icon}</span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>{opt.label}</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', fontSize: '14px', color: i === 0 ? 'var(--color-border)' : 'var(--color-primary)', padding: '2px 4px', fontFamily: 'var(--font-sans)' }}>←</button>
                  <button onClick={() => move(i, 1)} disabled={i === selected.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === selected.length - 1 ? 'default' : 'pointer', fontSize: '14px', color: i === selected.length - 1 ? 'var(--color-border)' : 'var(--color-primary)', padding: '2px 4px', fontFamily: 'var(--font-sans)' }}>→</button>
                  <button onClick={() => toggle(id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-error)', padding: '2px 4px' }}>×</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Disponibles */}
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          Añadir
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '24px' }}>
          {SHORTCUT_OPTIONS.filter(o => !selected.includes(o.id)).map(opt => {
            const disabled = selected.length >= MAX_SHORTCUTS
            return (
              <button key={opt.id} onClick={() => toggle(opt.id)} disabled={disabled}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                <span style={{ fontSize: '14px' }}>{opt.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{opt.label}</span>
              </button>
            )
          })}
          {SHORTCUT_OPTIONS.filter(o => !selected.includes(o.id)).length === 0 && (
            <div style={{ gridColumn: '1/-1', fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px' }}>
              Todas las opciones están seleccionadas
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleSave}
            style={{ flex: 1, background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '11px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
            Guardar
          </button>
          <button onClick={onClose}
            style={{ padding: '11px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Dashboard({ user, logout, onRefreshUser }) {
  const [tab, setTabRaw] = useState('estadisticas')
  const [visited, setVisited] = useState(() => new Set(['estadisticas']))
  const [canalesKey, setCanalesKey] = useState(0)
  const [socialKey, setSocialKey] = useState(0)
  const [tipstersKey, setTipstersKey] = useState(0)
  const [feedKey, setFeedKey] = useState(0)
  const [rankingKey, setRankingKey] = useState(0)
  const [amigosKey, setAmigosKey] = useState(0)
  const [miperfilKey, setMiperfilKey] = useState(0)
  const [historialKey, setHistorialKey] = useState(0)
  const [estadisticasKey, setEstadisticasKey] = useState(0)
  const [contactoKey, setContactoKey] = useState(0)
  const [configuracionKey, setConfiguracionKey] = useState(0)
  const [pendingSocialDMUserId, setPendingSocialDMUserId] = useState(null)
  const setTab = (id) => {
    // Reinicia el component de destinació en cada navegació
    if (id === 'canales') setCanalesKey(k => k + 1)
    if (id === 'social') { setSocialKey(k => k + 1); setPendingSocialDMUserId(null) }
    if (id === 'tipsters') setTipstersKey(k => k + 1)
    if (id === 'feed') setFeedKey(k => k + 1)
    if (id === 'ranking') setRankingKey(k => k + 1)
    if (id === 'amigos') setAmigosKey(k => k + 1)
    if (id === 'miperfil') setMiperfilKey(k => k + 1)
    if (id === 'historial') setHistorialKey(k => k + 1)
    if (id === 'estadisticas') setEstadisticasKey(k => k + 1)
    if (id === 'contacto' || id === 'sugerencias') setContactoKey(k => k + 1)
    if (id === 'configuracion') setConfiguracionKey(k => k + 1)
    setVisited(prev => new Set([...prev, id]))
    setTabRaw(id)
  }
  const handleStartDMExternal = (userId) => {
    setPendingSocialDMUserId(userId)
    setSocialKey(k => k + 1)
    setVisited(prev => new Set([...prev, 'social']))
    setTabRaw('social')
  }
  const [navAvatar, setNavAvatar] = useState(user?.avatar_url || null)
  const [showShortcutConfig, setShowShortcutConfig] = useState(false)

  const shortcutKey = `fyb_shortcuts_${user?.id}`
  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const saved = localStorage.getItem(shortcutKey)
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS
    } catch { return DEFAULT_SHORTCUTS }
  })

  const saveShortcuts = (next) => {
    setShortcuts(next)
    localStorage.setItem(shortcutKey, JSON.stringify(next))
  }

  const [showVerifiedModal, setShowVerifiedModal] = useState(false)
  const [adminWarning, setAdminWarning] = useState(null)        // text de l'avís admin
  const [deletedChannels, setDeletedChannels] = useState([])    // canals que han estat eliminats per admin

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('avatar_url, is_verified, verified_notified, admin_warning, warning_notified').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.avatar_url) setNavAvatar(data.avatar_url)
        // Mostra el modal una sola vegada quan l'admin verifica l'usuari
        if (data?.is_verified && !data?.verified_notified) {
          setShowVerifiedModal(true)
          supabase.from('profiles').update({ verified_notified: true }).eq('id', user.id).then()
        }
        // Mostra avís de l'admin una sola vegada
        if (data?.admin_warning && !data?.warning_notified) {
          setAdminWarning(data.admin_warning)
          supabase.from('profiles').update({ warning_notified: true }).eq('id', user.id).then()
        }
      })

    // Detecta canals propis eliminats per admin que encara no s'han notificat
    supabase.from('channels')
      .select('id, name, deletion_reason')
      .eq('owner_id', user.id)
      .not('deleted_at', 'is', null)
      .eq('deletion_notified', false)
      .then(({ data }) => {
        if (data?.length) {
          setDeletedChannels(data)
          supabase.from('channels').update({ deletion_notified: true }).in('id', data.map(c => c.id)).then()
        }
      })
  }, [user?.id])

  const [preselectedChannelId, setPreselectedChannelId] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    bets, allBets, loadingBets, showModal, setShowModal,
    form, setForm, submitBet, resolveBet,
    won, lost, yieldVal, avgOdds,
    period, setPeriod
  } = useBets(user)

  const unreadCount = useUnreadDMCount(user?.id)
  const { count: unreadChannelCount, unreadCounts: unreadChannelCounts, markRead: markChannelReadInstant } = useUnreadChannelCount(user?.id)

  // Comptador de feines pendents per a l'admin (peticions + suggerències en estat pending)
  const [adminPendingCount, setAdminPendingCount] = useState(0)
  const isAdminUser = ADMIN_EMAILS.includes(user?.email)
  const fetchAdminPending = useCallback(async () => {
    if (!isAdminUser) return
    const [{ count: t }, { count: s }] = await Promise.all([
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setAdminPendingCount((t || 0) + (s || 0))
  }, [isAdminUser])
  useEffect(() => { if (isAdminUser) fetchAdminPending() }, [isAdminUser, fetchAdminPending])
  usePolling(fetchAdminPending, 60000, isAdminUser)
  const { notifications, unreadCount: notifCount, markRead, markAllRead } = useNotifications(user?.id)
  const [showNotifs, setShowNotifs] = useState(false)

  const [pendingCanalCode, setPendingCanalCode] = useState(null)
  const [notifProfileUserId, setNotifProfileUserId] = useState(null)
  const [postModalId, setPostModalId] = useState(null)

  useEffect(() => {
    const canalCode = searchParams.get('canal')
    if (canalCode) {
      setPendingCanalCode(canalCode)
      setTab('canales')
      navigate('/dashboard', { replace: true })
    }
  }, [searchParams])

  const handleAddBetFromCanal = (channelId) => {
    setPreselectedChannelId(channelId)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setPreselectedChannelId(null)
  }

  const handleNavigateToChannel = (channel) => {
    setPendingCanalCode(channel.invite_code)
    setTab('canales')
  }

  return (
    <AdminModeProvider user={user}>
    <ProfileNavContext.Provider value={setNotifProfileUserId}>
    <>
    <div className="dashboard">
      <BetModal
        open={showModal}
        onClose={handleCloseModal}
        form={form}
        setForm={setForm}
        onSubmit={submitBet}
        user={user}
        preselectedChannelId={preselectedChannelId}
      />

      <AnimatePresence>
        {showShortcutConfig && (
          <ShortcutConfigModal
            shortcuts={shortcuts}
            onSave={saveShortcuts}
            onClose={() => setShowShortcutConfig(false)}
          />
        )}
      </AnimatePresence>

      {/* Avís de l'admin (text custom) — apareix una sola vegada */}
      <AnimatePresence>
        {adminWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-warning)', borderRadius: 'var(--radius-xl)', padding: '36px 28px', maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '12px', color: 'var(--color-warning)' }}>Aviso del equipo FYB</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'left', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '24px' }}>
                {adminWarning}
              </div>
              <button onClick={() => setAdminWarning(null)}
                style={{ background: 'var(--color-warning)', color: '#010906', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notificació de canal eliminat per admin — apareix una sola vegada */}
      <AnimatePresence>
        {deletedChannels.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 309, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '36px 28px', maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '0 0 40px rgba(239,68,68,0.25)' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>🚫</div>
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '12px', color: 'var(--color-error)' }}>
                {deletedChannels.length === 1 ? 'Canal eliminado' : `${deletedChannels.length} canales eliminados`}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                El equipo de FYB ha eliminado los siguientes canales tuyos:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {deletedChannels.map(c => (
                  <div key={c.id} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{c.name}</div>
                    {c.deletion_reason && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        <strong>Motivo:</strong> {c.deletion_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setDeletedChannels([])}
                style={{ background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de verificació — apareix una sola vegada quan l'admin verifica l'usuari */}
      <AnimatePresence>
        {showVerifiedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-xl)', padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 0 40px rgba(15,110,86,0.2)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 900, color: '#010906', margin: '0 auto 20px' }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: '10px' }}>¡Estás verificado en FYB!</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
                El equipo de FYB ha verificado tu cuenta. A partir de ahora:<br />
                <span style={{ color: 'var(--color-text)' }}>✓ Badge verificado visible en tu perfil</span><br />
                <span style={{ color: 'var(--color-text)' }}>✓ Apareces en la sección Verificados de Tipsters</span><br />
                <span style={{ color: 'var(--color-text)' }}>✓ Acceso prioritario a futuras funciones exclusivas</span>
              </div>
              <button onClick={() => setShowVerifiedModal(false)}
                style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                ¡Genial!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAV */}
      <motion.nav className="dash-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="dash-nav-left">
          <div className="dash-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>FindYour<span>Bet</span></div>
          <div className="dash-nav-tabs">
            {shortcuts.map(id => {
              const opt = SHORTCUT_OPTIONS.find(o => o.id === id)
              if (!opt) return null
              return (
                <motion.button key={id}
                  className={`dash-tab ${tab === id ? 'active' : ''}`}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTab(id)}>
                  {opt.label}
                  {id === 'social' && unreadCount > 0 && (
                    <span style={{ marginLeft: '6px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </motion.button>
              )
            })}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setShowShortcutConfig(true)}
              title="Personalizar atajos"
              style={{ padding: '7px 10px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              ✏️
            </motion.button>
          </div>
        </div>
        <div className="dash-nav-right">
          {/* CAMPANA NOTIFICACIONS */}
          <div style={{ position: 'relative' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const next = !showNotifs; setShowNotifs(next); if (!next) markAllRead() }}
              style={{ position: 'relative', background: showNotifs ? 'var(--color-bg-soft)' : 'none', border: '0.5px solid', borderColor: showNotifs ? 'var(--color-border)' : 'transparent', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: '7px 10px', fontSize: '18px', display: 'flex', alignItems: 'center' }}>
              🔔
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '9px', fontWeight: 700, padding: '1px 5px', minWidth: '16px', textAlign: 'center', lineHeight: '14px' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </motion.button>
            <AnimatePresence>
              {showNotifs && (
                <NotificationsPanel
                  notifications={notifications}
                  onClose={() => { setShowNotifs(false); markAllRead() }}
                  onMarkAllRead={markAllRead}
                  currentUser={user}
                  onViewProfile={(userId) => { setNotifProfileUserId(userId); setShowNotifs(false) }}
                  onViewPost={(msgId) => { setPostModalId(msgId); setShowNotifs(false) }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="user-chip" style={{ cursor: 'pointer' }}
            onClick={() => setTab('miperfil')}>
            <Avatar url={navAvatar} name={user?.username || 'U'} size={28} bg="var(--color-primary)" fg="var(--color-primary-light)" />
            <span><Username username={user?.username || 'Usuario'} isVerified={user?.is_verified} size="sm" /></span>
          </div>
          <motion.button className="dash-tab" whileTap={{ scale: 0.98 }} onClick={logout}>
            Salir
          </motion.button>
        </div>
      </motion.nav>

      <div className="dash-layout">

        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <div className="sidebar-section">
            <button className="sidebar-item" onClick={() => setShowModal(true)}>
              <span className="sidebar-icon">✏️</span>
              Nueva Apuesta
            </button>
          </div>
          {SIDEBAR.map(section => (
            <div key={section.label} style={{ marginBottom: '8px' }}>
              <div className="sidebar-label">{section.label}</div>
              {section.items.map(item => (
                <div key={item.id} className="sidebar-section">
                  <button
                    className={`sidebar-item ${tab === item.id ? 'active' : ''}`}
                    onClick={() => setTab(item.id)}>
                    <span className="sidebar-icon">{item.icon}</span>
                    {item.label}
                    {item.id === 'social' && unreadCount > 0 && (
                      <span style={{ marginLeft: 'auto', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    {item.id === 'canales' && unreadChannelCount > 0 && (
                      <span style={{ marginLeft: 'auto', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                        {unreadChannelCount > 9 ? '9+' : unreadChannelCount}
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ))}

          {/* Accés al Centre de Control — només visible per a admins */}
          {ADMIN_EMAILS.includes(user?.email) && (
            <div className="sidebar-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--color-border)' }}>
              <button
                className={`sidebar-item ${tab === 'admin' ? 'active' : ''}`}
                onClick={() => setTab('admin')}>
                <span className="sidebar-icon">⚙️</span>
                Centro de control
                {adminPendingCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                    {adminPendingCount > 9 ? '9+' : adminPendingCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </aside>

        {/* CONTINGUT */}
        <div className="dash-content">

          {visited.has('estadisticas') && (
            <div style={{ display: tab === 'estadisticas' ? 'block' : 'none' }}>
              <Estadisticas key={estadisticasKey}
                bets={bets} allBets={allBets} loadingBets={loadingBets}
                won={won} lost={lost} yieldVal={yieldVal} avgOdds={avgOdds}
                onNewBet={() => setShowModal(true)}
                period={period} onPeriodChange={setPeriod}
                onNavigateToHistorial={() => setTab('historial')}
              />
            </div>
          )}

          {visited.has('historial') && (
            <div style={{ display: tab === 'historial' ? 'block' : 'none' }}>
              <Historial key={historialKey}
                bets={allBets} loadingBets={loadingBets}
                onNewBet={() => setShowModal(true)} onResolveBet={resolveBet}
                user={user}
              />
            </div>
          )}

          {visited.has('canales') && (
            <div style={{ display: tab === 'canales' ? 'block' : 'none' }}>
              <Canales
                key={canalesKey}
                user={user}
                initialCanalCode={pendingCanalCode}
                onCanalCodeUsed={() => setPendingCanalCode(null)}
                onAddBet={handleAddBetFromCanal}
                unreadChannelCounts={unreadChannelCounts}
                onMarkChannelRead={markChannelReadInstant}
              />
            </div>
          )}

          {visited.has('feed') && (
            <div style={{ display: tab === 'feed' ? 'block' : 'none' }}>
              <Feed key={feedKey} user={user} onNavigateToChannel={handleNavigateToChannel} />
            </div>
          )}

          {visited.has('tipsters') && (
            <div style={{ display: tab === 'tipsters' ? 'block' : 'none' }}>
              <Tipsters key={tipstersKey} user={user} onNavigateToChannel={handleNavigateToChannel} onStartDM={handleStartDMExternal} />
            </div>
          )}

          {visited.has('social') && (
            <div style={{ display: tab === 'social' ? 'block' : 'none' }}>
              <Social key={socialKey} user={user} initialDMUserId={pendingSocialDMUserId} />
            </div>
          )}

          {visited.has('ranking') && (
            <div style={{ display: tab === 'ranking' ? 'block' : 'none' }}>
              <Ranking key={rankingKey} user={user} />
            </div>
          )}

          {visited.has('amigos') && (
            <div style={{ display: tab === 'amigos' ? 'block' : 'none' }}>
              <RankingAmigos key={amigosKey} user={user} />
            </div>
          )}

          {visited.has('faqs') && (
            <div style={{ display: tab === 'faqs' ? 'block' : 'none' }}>
              <Faqs />
            </div>
          )}

          {(visited.has('contacto') || visited.has('sugerencias')) && (
            <div style={{ display: (tab === 'contacto' || tab === 'sugerencias') ? 'block' : 'none' }}>
              <Contacto key={contactoKey} initialTab={tab} user={user} />
            </div>
          )}

          {/* Centre de control admin — sense visited check, es munta/desmunta directament */}
          {tab === 'admin' && ADMIN_EMAILS.includes(user?.email) && (
            <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>⏳ Cargando panel...</div>}>
              <AdminPanel user={user} />
            </Suspense>
          )}

          {visited.has('miperfil') && (
            <div style={{ display: tab === 'miperfil' ? 'block' : 'none' }}>
              <MiPerfil key={miperfilKey} user={user} onNavigate={setTab} onAvatarUpdated={(url) => { setNavAvatar(url); onRefreshUser?.() }} onNavigateToChannel={handleNavigateToChannel} />
            </div>
          )}

          {visited.has('configuracion') && (
            <div style={{ display: tab === 'configuracion' ? 'block' : 'none' }}>
              <Configuracion key={configuracionKey} user={user} logout={logout} />
            </div>
          )}

        </div>
      </div>
    </div>

    <AnimatePresence>
      {postModalId && (
        <PostModal messageId={postModalId} currentUser={user} onClose={() => setPostModalId(null)} />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {notifProfileUserId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setNotifProfileUserId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', padding: '20px', boxSizing: 'border-box' }}>
            <ProfileView userId={notifProfileUserId} currentUser={user} onBack={() => setNotifProfileUserId(null)} onStartDM={(userId) => { setNotifProfileUserId(null); handleStartDMExternal(userId) }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
    </ProfileNavContext.Provider>
    </AdminModeProvider>
  )
}
