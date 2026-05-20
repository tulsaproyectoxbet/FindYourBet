import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBets } from './hooks/useBets'
import { useUnreadDMCount } from './social/hooks/useUnreadDMCount'
import { BetModal } from './BetModal'
import Estadisticas from './Estadisticas'
import Historial from './MisApuestas'
import Ranking from './Ranking'
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
  { id: 'faqs',         label: 'FAQs',              icon: '❓' },
  { id: 'contacto',     label: 'Contacto',          icon: '📱' },
  { id: 'sugerencias',  label: 'Sugerencias',       icon: '💡' },
]

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
      { id: 'ranking', label: 'Ranking', icon: '🏆' },
    ]
  },
  {
    label: 'Ayuda',
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
  const [pendingSocialDMUserId, setPendingSocialDMUserId] = useState(null)
  const setTab = (id) => {
    if (tab === 'canales' && id !== 'canales') setCanalesKey(k => k + 1)
    if (tab === 'social' && id !== 'social') { setSocialKey(k => k + 1); setPendingSocialDMUserId(null) }
    if (tab === 'tipsters' && id !== 'tipsters') setTipstersKey(k => k + 1)
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

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => { if (data?.avatar_url) setNavAvatar(data.avatar_url) })
  }, [user?.id])

  const [preselectedChannelId, setPreselectedChannelId] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    bets, allBets, loadingBets, showModal, setShowModal,
    form, setForm, submitBet, resolveBet, deleteBet, updateBet,
    won, lost, yieldVal, avgOdds,
    period, setPeriod
  } = useBets(user)

  const unreadCount = useUnreadDMCount(user?.id)
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
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const next = !showNotifs; setShowNotifs(next); if (next) markAllRead() }}
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
                  onClose={() => setShowNotifs(false)}
                  currentUser={user}
                  onViewProfile={(userId) => { setNotifProfileUserId(userId); setShowNotifs(false) }}
                  onViewPost={(msgId) => { setPostModalId(msgId); setShowNotifs(false) }}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="user-chip" style={{ cursor: 'pointer' }}
            onClick={() => setTab('miperfil')}>
            <div className="user-avatar" style={{ overflow: 'hidden', padding: 0 }}>
              {navAvatar
                ? <img src={navAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : (user?.username || 'U')[0].toUpperCase()}
            </div>
            <span>{user?.username || 'Usuario'}</span>
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
                  </button>
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* CONTINGUT */}
        <div className="dash-content">

          {visited.has('estadisticas') && (
            <div style={{ display: tab === 'estadisticas' ? 'block' : 'none' }}>
              <Estadisticas
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
              <Historial
                bets={allBets} loadingBets={loadingBets}
                onNewBet={() => setShowModal(true)} onResolveBet={resolveBet}
                onDeleteBet={deleteBet} onUpdateBet={updateBet}
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
              />
            </div>
          )}

          {visited.has('feed') && (
            <div style={{ display: tab === 'feed' ? 'block' : 'none' }}>
              <Feed user={user} onNavigateToChannel={handleNavigateToChannel} />
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
              <Ranking user={user} />
            </div>
          )}

          {visited.has('faqs') && (
            <div style={{ display: tab === 'faqs' ? 'block' : 'none' }}>
              <Faqs />
            </div>
          )}

          {(visited.has('contacto') || visited.has('sugerencias')) && (
            <div style={{ display: (tab === 'contacto' || tab === 'sugerencias') ? 'block' : 'none' }}>
              <Contacto initialTab={tab} />
            </div>
          )}

          {visited.has('miperfil') && (
            <div style={{ display: tab === 'miperfil' ? 'block' : 'none' }}>
              <MiPerfil user={user} onNavigate={setTab} onAvatarUpdated={(url) => { setNavAvatar(url); onRefreshUser?.() }} onNavigateToChannel={handleNavigateToChannel} />
            </div>
          )}

          {visited.has('configuracion') && (
            <div style={{ display: tab === 'configuracion' ? 'block' : 'none' }}>
              <Configuracion user={user} logout={logout} />
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
  )
}
