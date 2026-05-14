import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useBets } from './hooks/useBets'
import { useDMs } from './social/hooks/useDMs'
import { BetModal } from './BetModal'
import Estadisticas from './Estadisticas'
import Historial from './MisApuestas'
import Ranking from './Ranking'
import Canales from './canales'
import Contacto from './Contacto'
import Social from './social'
import MiPerfil from './social/MiPerfil'
import Feed from './feed'
import { useNotifications } from './notifications/useNotifications'
import NotificationsPanel from './notifications/NotificationsPanel'
import Configuracion from './Configuracion'
import './dashboard.css'

const NAV_TABS = [
  { id: 'estadisticas', label: 'Perfil' },
  { id: 'social', label: 'Social' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'contacto', label: 'Contacto' },
]

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
    label: 'Contáctenos',
    items: [
      { id: 'contacto', label: 'Redes sociales & Soporte', icon: '📱' },
      { id: 'sugerencias', label: 'Ayúdanos a mejorar', icon: '💡' },
    ]
  },
]

export default function Dashboard({ user, logout }) {
  const [tab, setTab] = useState('estadisticas')
  const [preselectedChannelId, setPreselectedChannelId] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    bets, allBets, loadingBets, showModal, setShowModal,
    form, setForm, submitBet, resolveBet, deleteBet,
    won, lost, yieldVal, avgOdds,
    period, setPeriod
  } = useBets(user)

  const { unreadCount } = useDMs(user?.id)
  const { notifications, unreadCount: notifCount, markRead, markAllRead } = useNotifications(user?.id)
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => {
    const canalCode = searchParams.get('canal')
    if (canalCode) setTab('canales')
  }, [searchParams])

  const canalCode = searchParams.get('canal')

  const handleAddBetFromCanal = (channelId) => {
    setPreselectedChannelId(channelId)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setPreselectedChannelId(null)
  }

  const activeNavTab = ['social', 'canales', 'feed'].includes(tab) ? 'social'
    : ['contacto', 'sugerencias'].includes(tab) ? 'contacto'
    : ['miperfil', 'historial', 'configuracion'].includes(tab) ? 'estadisticas'
    : tab

  const handleNavigateToChannel = (channel) => {
    navigate(`/dashboard?canal=${channel.invite_code}`)
    setTab('canales')
  }

  return (
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

      {/* NAV */}
      <motion.nav className="dash-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="dash-nav-left">
          <div className="dash-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>FindYour<span>Bet</span></div>
          <div className="dash-nav-tabs">
            {NAV_TABS.map(t => (
              <motion.button key={t.id}
                className={`dash-tab ${activeNavTab === t.id ? 'active' : ''}`}
                whileTap={{ scale: 0.97 }}
                onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === 'social' && unreadCount > 0 && (
                  <span style={{ marginLeft: '6px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </motion.button>
            ))}
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
                />
              )}
            </AnimatePresence>
          </div>

          <div className="user-chip" style={{ cursor: 'pointer' }}
            onClick={() => setTab('miperfil')}>
            <div className="user-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
            <span>{user?.name || 'Usuario'}</span>
          </div>
          <motion.button className="dash-tab" whileTap={{ scale: 0.98 }} onClick={logout}>
            Salir
          </motion.button>
        </div>
      </motion.nav>

      <div className="dash-layout">

        {/* SIDEBAR SEMPRE VISIBLE */}
        <aside className="dash-sidebar">
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
          <AnimatePresence mode="wait">

            {tab === 'estadisticas' && (
              <Estadisticas key="estadisticas"
                bets={bets} loadingBets={loadingBets}
                won={won} lost={lost} yieldVal={yieldVal} avgOdds={avgOdds}
                onNewBet={() => setShowModal(true)}
                period={period} onPeriodChange={setPeriod}
              />
            )}

            {tab === 'historial' && (
              <Historial key="historial"
                bets={bets} loadingBets={loadingBets}
                won={won} lost={lost} yieldVal={yieldVal} avgOdds={avgOdds}
                onNewBet={() => setShowModal(true)} onResolveBet={resolveBet}
                onDeleteBet={deleteBet}
                period={period} onPeriodChange={setPeriod}
              />
            )}

            {tab === 'canales' && (
              <Canales key="canales"
                user={user}
                initialCanalCode={canalCode}
                onAddBet={handleAddBetFromCanal}
              />
            )}

            {tab === 'feed' && (
              <Feed key="feed" user={user} onNavigateToChannel={handleNavigateToChannel} />
            )}

            {tab === 'social' && (
              <Social key="social" user={user} />
            )}

            {tab === 'ranking' && (
              <Ranking key="ranking" user={user} />
            )}

            {(tab === 'contacto' || tab === 'sugerencias') && (
              <Contacto key={tab} initialTab={tab} />
            )}

            {tab === 'miperfil' && (
              <MiPerfil key="miperfil" user={user} onNavigate={setTab} />
            )}

            {tab === 'configuracion' && (
              <Configuracion key="configuracion" user={user} logout={logout} />
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}