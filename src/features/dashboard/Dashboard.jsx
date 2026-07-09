import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../components/ui/AppIcon'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import { usePolling } from '../../hooks/usePolling'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBets } from './hooks/useBets'
import { useUnreadDMCount } from './social/hooks/useUnreadDMCount'
import { useUnreadChannelCount } from '../../hooks/useUnreadChannelCount'
import { usePresence } from '../../hooks/usePresence'
import { useFollow } from './social/hooks/useFollow'
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
// AdminPanel és pesant i només l'usa fyourbet — code-split per reduir el bundle inicial
const AdminPanel = lazy(() => import('../admin/AdminPanel'))
import Username from '../../components/ui/Username'
import Avatar from '../../components/ui/Avatar'
import { ProfileNavContext } from '../../contexts/ProfileNavContext'
import { AdminModeProvider } from '../../contexts/AdminModeContext'
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode'
import MaintenanceOverlay from '../../components/ui/MaintenanceOverlay'
import './dashboard.css'

const APP_VERSION = 'v0.9 · Beta pública'

const SHORTCUT_OPTIONS = [
  { id: 'miperfil',     labelKey: 'dashboard.tabs.profile',       icon: 'user' },
  { id: 'estadisticas', labelKey: 'dashboard.tabs.statistics',    icon: 'stats' },
  { id: 'historial',    labelKey: 'dashboard.tabs.history',       icon: 'historial' },
  { id: 'social',       labelKey: 'dashboard.tabs.messages',      icon: 'social' },
  { id: 'canales',      labelKey: 'dashboard.tabs.channels',      icon: 'canales' },
  { id: 'feed',         labelKey: 'dashboard.tabs.feed',          icon: 'feed' },
  { id: 'tipsters',     labelKey: 'dashboard.tabs.tipsters',      icon: 'tipsters' },
  { id: 'ranking',      labelKey: 'dashboard.tabs.ranking',       icon: 'ranking' },
  { id: 'faqs',         labelKey: 'dashboard.tabs.faqs',          icon: 'faqs' },
  { id: 'contacto',     labelKey: 'dashboard.tabs.contact',       icon: 'contacto' },
  { id: 'sugerencias',  labelKey: 'dashboard.tabs.suggestions',   icon: 'sugerencias' },
]

// Emails amb accés al panell d'admin — ha de coincidir amb ADMIN_EMAILS a AdminPanel.jsx
const ADMIN_EMAILS = ['fyourbet@gmail.com']

// Cada shortcut és un objecte: { type:'tab'|'dm'|'channel', ... }
const scKey = (item) =>
  item.type === 'tab' ? `tab:${item.id}`
  : item.type === 'dm' ? `dm:${item.userId}`
  : `ch:${item.channelId}`

const DEFAULT_SHORTCUTS = [
  { type: 'tab', id: 'estadisticas', icon: 'stats' },
  { type: 'tab', id: 'social',       icon: 'social' },
  { type: 'tab', id: 'canales',      icon: 'canales' },
  { type: 'tab', id: 'ranking',      icon: 'ranking' },
  { type: 'tab', id: 'contacto',     icon: 'contacto' },
]
const MAX_SHORTCUTS = 7

const SIDEBAR = [
  {
    labelKey: 'dashboard.sidebar.myProfile',
    items: [
      { id: 'miperfil',     labelKey: 'dashboard.tabs.profile',       icon: 'user' },
      { id: 'estadisticas', labelKey: 'dashboard.tabs.personalStats', icon: 'stats' },
      { id: 'historial',    labelKey: 'dashboard.tabs.history',       icon: 'historial' },
    ]
  },
  {
    labelKey: 'dashboard.sidebar.social',
    items: [
      { id: 'social',    labelKey: 'dashboard.tabs.messages', icon: 'social' },
      { id: 'canales',   labelKey: 'dashboard.tabs.channels', icon: 'canales' },
      { id: 'feed',      labelKey: 'dashboard.tabs.feed',     icon: 'feed' },
      { id: 'tipsters',  labelKey: 'dashboard.tabs.tipsters', icon: 'tipsters' },
      { id: 'ranking',   labelKey: 'dashboard.tabs.ranking',  icon: 'ranking' },
    ]
  },
  {
    labelKey: 'dashboard.sidebar.contact',
    items: [
      { id: 'faqs',        labelKey: 'dashboard.tabs.faqs',         icon: 'faqs' },
      { id: 'contacto',    labelKey: 'dashboard.tabs.socialSupport', icon: 'contacto' },
      { id: 'sugerencias', labelKey: 'dashboard.tabs.helpImprove',  icon: 'sugerencias' },
    ]
  },
]

function ShortcutConfigModal({ shortcuts, onSave, onClose, userId }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState([...shortcuts])
  const [view, setView] = useState('main') // 'main' | 'dm' | 'canal'
  const [dmList, setDmList]         = useState([])
  const [channelList, setChannelList] = useState([])
  const [subLoading, setSubLoading] = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isAdded = (item) => selected.some(s => scKey(s) === scKey(item))
  const full = selected.length >= MAX_SHORTCUTS

  const add = (item) => {
    if (full || isAdded(item)) return
    setSelected(prev => [...prev, item])
    setView('main')
  }

  const remove = (idx) => setSelected(prev => prev.filter((_, i) => i !== idx))

  const move = (index, dir) => {
    const next = [...selected]
    const to = index + dir
    if (to < 0 || to >= next.length) return
    ;[next[index], next[to]] = [next[to], next[index]]
    setSelected(next)
  }

  const openDMPicker = async () => {
    setView('dm')
    setSubLoading(true)
    try {
      const { data: convs } = await supabase
        .from('dm_conversations')
        .select('id, user1_id, user2_id, user1_hidden_at, user2_hidden_at')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20)
      const visible = (convs || []).filter(c => {
        const h = c.user1_id === userId ? c.user1_hidden_at : c.user2_hidden_at
        return !h
      })
      if (visible.length) {
        const otherIds = visible.map(c => c.user1_id === userId ? c.user2_id : c.user1_id)
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', otherIds)
        const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setDmList(visible.map(c => {
          const oid = c.user1_id === userId ? c.user2_id : c.user1_id
          return { userId: oid, username: pm[oid]?.username || '?' }
        }))
      }
    } catch { /* silenci */ }
    setSubLoading(false)
  }

  const openCanalPicker = async () => {
    setView('canal')
    setSubLoading(true)
    try {
      const [{ data: memberData }, { data: ownedData }] = await Promise.all([
        supabase.from('channel_members').select('channels(id, name, invite_code, is_private, deleted_at)').eq('user_id', userId).limit(30),
        supabase.from('channels').select('id, name, invite_code, is_private, deleted_at').eq('owner_id', userId).is('deleted_at', null).limit(10),
      ])
      const fromMembership = (memberData || []).map(m => m.channels).filter(c => c && !c.deleted_at)
      const fromOwned = (ownedData || [])
      // Canals propis primers, sense duplicats
      const seen = new Set()
      const merged = [...fromOwned, ...fromMembership].filter(c => {
        if (!c || seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
      setChannelList(merged)
    } catch { /* silenci */ }
    setSubLoading(false)
  }

  const itemLabel = (item) => {
    if (item.type === 'tab') {
      const opt = SHORTCUT_OPTIONS.find(o => o.id === item.id)
      return opt ? t(opt.labelKey) : item.id
    }
    if (item.type === 'dm') return item.username
    return item.name
  }

  const itemIcon = (item) => {
    if (item.type === 'tab') return SHORTCUT_OPTIONS.find(o => o.id === item.id)?.icon || 'user'
    if (item.type === 'dm') return 'social'
    return item.isPrivate ? 'lock' : 'canales'
  }

  // ── Estils reutilitzables ──────────────────────────────────────────────────
  const rowBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', textAlign: 'left', width: '100%', transition: 'background 0.12s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const hover = { onMouseEnter: e => e.currentTarget.style.background = 'var(--color-bg-soft)', onMouseLeave: e => e.currentTarget.style.background = 'none' }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '28px', width: '100%', maxWidth: '460px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>

        {/* Capçalera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {view !== 'main' && (
              <button onClick={() => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '0 4px 0 0' }}>{t('common.back')}</button>
            )}
            <div style={{ fontWeight: 700, fontSize: '16px' }}>
              {view === 'main' ? t('dashboard.shortcuts.title') : view === 'dm' ? t('dashboard.tabs.messages') : t('dashboard.tabs.channels')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>×</button>
        </div>

        {view === 'main' && (
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', flexShrink: 0 }}>
            {t('dashboard.shortcuts.subtitle', { max: MAX_SHORTCUTS })}
          </div>
        )}
        {view !== 'main' && (
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px', flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: t('dashboard.shortcuts.pickerHint') }} />
        )}

        {/* Cos amb scroll */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>

          {/* ── Vista principal ── */}
          {view === 'main' && (
            <>
              {/* Seleccionados */}
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                {t('dashboard.shortcuts.selected', { current: selected.length, max: MAX_SHORTCUTS })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', minHeight: '48px' }}>
                {selected.length === 0 && (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', textAlign: 'center', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    Ningún atajo seleccionado
                  </div>
                )}
                {selected.map((item, i) => (
                  <div key={scKey(item)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)' }}>
                    <AppIcon name={itemIcon(item)} size={15} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemLabel(item)}</span>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button onClick={() => move(i, -1)} disabled={i === 0}
                        style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', fontSize: '14px', color: i === 0 ? 'var(--color-border)' : 'var(--color-primary)', padding: '2px 4px', fontFamily: 'var(--font-sans)' }}>←</button>
                      <button onClick={() => move(i, 1)} disabled={i === selected.length - 1}
                        style={{ background: 'none', border: 'none', cursor: i === selected.length - 1 ? 'default' : 'pointer', fontSize: '14px', color: i === selected.length - 1 ? 'var(--color-border)' : 'var(--color-primary)', padding: '2px 4px', fontFamily: 'var(--font-sans)' }}>→</button>
                      <button onClick={() => remove(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-error)', padding: '2px 4px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Añadir */}
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('dashboard.shortcuts.addSection')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {SHORTCUT_OPTIONS.map(opt => {
                  const needsPicker = opt.id === 'social' || opt.id === 'canales'
                  const disabled = full
                  return (
                    <button key={opt.id} disabled={disabled}
                      onClick={() => {
                        if (needsPicker) { opt.id === 'social' ? openDMPicker() : openCanalPicker() }
                        else add({ type: 'tab', id: opt.id, icon: opt.icon })
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', justifyContent: needsPicker ? 'space-between' : undefined }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AppIcon name={opt.icon} size={14} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{t(opt.labelKey)}</span>
                      </span>
                      {needsPicker && <AppIcon name="chevronRight" size={12} color="var(--color-text-muted)" />}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Picker de DMs ── */}
          {view === 'dm' && (
            <>
              <button disabled={full || isAdded({ type: 'tab', id: 'social' })}
                onClick={() => add({ type: 'tab', id: 'social', icon: 'social' })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '11px 14px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', cursor: (full || isAdded({ type: 'tab', id: 'social' })) ? 'default' : 'pointer', opacity: (full || isAdded({ type: 'tab', id: 'social' })) ? 0.5 : 1, fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  <AppIcon name="social" size={15} /> {t('dashboard.shortcuts.messagesGeneral')}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{t('common.accept')}</span>
              </button>
              {subLoading && <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>}
              {!subLoading && dmList.length === 0 && <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('common.noConversations')}</div>}
              {!subLoading && dmList.map(dm => {
                const item = { type: 'dm', userId: dm.userId, username: dm.username }
                const added = isAdded(item)
                return (
                  <button key={dm.userId} disabled={full || added} {...hover}
                    onClick={() => add(item)}
                    style={{ ...rowBtn, opacity: (full || added) ? 0.4 : 1, cursor: (full || added) ? 'default' : 'pointer', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AppIcon name="social" size={14} color="var(--color-text-muted)" />
                      @{dm.username}
                    </span>
                    {added && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('common.added')}</span>}
                  </button>
                )
              })}
            </>
          )}

          {/* ── Picker de canals ── */}
          {view === 'canal' && (
            <>
              <button disabled={full || isAdded({ type: 'tab', id: 'canales' })}
                onClick={() => add({ type: 'tab', id: 'canales', icon: 'canales' })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '11px 14px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', cursor: (full || isAdded({ type: 'tab', id: 'canales' })) ? 'default' : 'pointer', opacity: (full || isAdded({ type: 'tab', id: 'canales' })) ? 0.5 : 1, fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  <AppIcon name="canales" size={15} /> {t('dashboard.shortcuts.channelsGeneral')}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{t('common.accept')}</span>
              </button>
              {subLoading && <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('common.loading')}</div>}
              {!subLoading && channelList.length === 0 && <div style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('common.noChannels')}</div>}
              {!subLoading && channelList.map(ch => {
                const item = { type: 'channel', channelId: ch.id, inviteCode: ch.invite_code, name: ch.name, isPrivate: ch.is_private }
                const added = isAdded(item)
                return (
                  <button key={ch.id} disabled={full || added} {...hover}
                    onClick={() => add(item)}
                    style={{ ...rowBtn, opacity: (full || added) ? 0.4 : 1, cursor: (full || added) ? 'default' : 'pointer', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AppIcon name={ch.is_private ? 'lock' : 'canales'} size={14} color="var(--color-text-muted)" />
                      {ch.name}
                    </span>
                    {added && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t('common.added')}</span>}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Botons inferiors — només a la vista principal */}
        {view === 'main' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexShrink: 0 }}>
            <button onClick={() => { onSave(selected); onClose() }}
              style={{ flex: 1, background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '11px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              {t('common.save')}
            </button>
            <button onClick={onClose}
              style={{ padding: '11px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
              {t('common.cancel')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function Dashboard({ user, logout, onRefreshUser }) {
  const { t } = useTranslation()
  const maintenance = useMaintenanceMode(user?.id)
  const [tab, setTabRaw] = useState('miperfil')
  const [visited, setVisited] = useState(() => new Set(['miperfil']))
  const [canalesKey, setCanalesKey] = useState(0)
  const [socialKey, setSocialKey] = useState(0)
  const [tipstersKey, setTipstersKey] = useState(0)
  const [feedKey, setFeedKey] = useState(0)
  const [rankingKey, setRankingKey] = useState(0)
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
      if (!saved) return DEFAULT_SHORTCUTS
      const parsed = JSON.parse(saved)
      // Migra format antic (string[]) → nou format (object[])
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'string') {
        return parsed.map(id => {
          const opt = SHORTCUT_OPTIONS.find(o => o.id === id)
          return opt ? { type: 'tab', id: opt.id, icon: opt.icon } : null
        }).filter(Boolean)
      }
      return parsed
    } catch { return DEFAULT_SHORTCUTS }
  })

  const saveShortcuts = (next) => {
    setShortcuts(next)
    localStorage.setItem(shortcutKey, JSON.stringify(next))
  }

  const [showVerifiedModal, setShowVerifiedModal] = useState(false)
  const [showBetaModal, setShowBetaModal] = useState(false)
  const [adminWarning, setAdminWarning] = useState(null)
  const [deletedChannels, setDeletedChannels] = useState([])
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

  const { count: unreadCount, setConvCount: setDmUnreadCount, refetch: refetchDmUnread } = useUnreadDMCount(user?.id)
  const { count: unreadChannelCount, unreadCounts: unreadChannelCounts, setChannelCount: setChannelUnreadCount, setActiveChannel: setActiveChannelUnread, refetch: refetchChannelUnread } = useUnreadChannelCount(user?.id)
  // Heartbeat de presència: alimenta les analítiques d'usuaris actius de l'admin.
  usePresence(user?.id)
  // Follow compartit per al perfil emergent global (mateixa font que Social/Tipsters).
  const globalFollow = useFollow(user?.id)

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
  const [pendingCanalAction, setPendingCanalAction] = useState(null)
  const [notifProfileUserId, setNotifProfileUserId] = useState(null)
  const [postModalId, setPostModalId] = useState(null)

  useEffect(() => {
    const canalCode = searchParams.get('canal')
    const action = searchParams.get('action')
    if (canalCode) {
      setPendingCanalCode(canalCode)
      setTab('canales')
      navigate('/dashboard', { replace: true })
    }
    if (action === 'buscar' || action === 'crear') {
      setPendingCanalAction(action)
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
    {maintenance.isActive && (
      <MaintenanceOverlay
        message={maintenance.message}
        estimatedDuration={maintenance.estimatedDuration}
        onExit={logout}
      />
    )}
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
            userId={user?.id}
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
              <div style={{ marginBottom: '14px' }}><AppIcon name="warning" size={40} color="var(--color-warning)" /></div>
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '12px', color: 'var(--color-warning)' }}>{t('dashboard.modals.adminWarning')}</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'left', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '24px' }}>
                {adminWarning}
              </div>
              <button onClick={() => setAdminWarning(null)}
                style={{ background: 'var(--color-warning)', color: '#010906', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                {t('common.understood')}
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
              <div style={{ marginBottom: '14px' }}><AppIcon name="ban" size={40} color="var(--color-error)" /></div>
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '12px', color: 'var(--color-error)' }}>
                {t('dashboard.modals.channelDeleted', { count: deletedChannels.length })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                {t('dashboard.modals.channelDeletedBy')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {deletedChannels.map(c => (
                  <div key={c.id} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{c.name}</div>
                    {c.deletion_reason && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        <strong>{t('dashboard.modals.reason')}</strong> {c.deletion_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setDeletedChannels([])}
                style={{ background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                {t('common.understood')}
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
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#010906', margin: '0 auto 20px' }}><AppIcon name="check" size={26} /></div>
              <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: '10px' }}>{t('dashboard.modals.verifiedTitle')}</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
                {t('dashboard.modals.verifiedDesc')}<br />
                <span style={{ color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="check" size={12} color="var(--color-primary)" /> {t('dashboard.modals.verifiedBadge')}</span><br />
                <span style={{ color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="check" size={12} color="var(--color-primary)" /> {t('dashboard.modals.verifiedSection')}</span><br />
                <span style={{ color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AppIcon name="check" size={12} color="var(--color-primary)" /> {t('dashboard.modals.verifiedAccess')}</span>
              </div>
              <button onClick={() => setShowVerifiedModal(false)}
                style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                {t('common.great')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal BETA — explica què és FYB, l'objectiu, com usar-la, què inclou ara i què arribarà */}
      <AnimatePresence>
        {showBetaModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowBetaModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', maxWidth: '560px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(0,0,0,0.4)' }}>
              {/* Capçalera fixa */}
              <div style={{ padding: '28px 28px 18px', borderBottom: '0.5px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '21px', fontWeight: 800 }}>FindYour<span style={{ color: 'var(--color-primary)' }}>Bet</span></div>
                  <button onClick={() => setShowBetaModal(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><AppIcon name="close" size={18} /></button>
                </div>
                <span style={{ display: 'inline-block', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '0.5px solid var(--color-primary-border)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
                  {APP_VERSION}
                </span>
              </div>

              {/* Cos amb scroll */}
              <div style={{ padding: '20px 28px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <section>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('dashboard.modals.betaWhat')}</div>
                  <p style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.65, margin: 0 }}
                    dangerouslySetInnerHTML={{ __html: t('dashboard.modals.betaDescP1') }} />
                  <p style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.65, margin: '10px 0 0' }}
                    dangerouslySetInnerHTML={{ __html: t('dashboard.modals.betaDescP2') }} />
                </section>

                <section>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('dashboard.modals.betaHow')}</div>
                  <ul style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['betaHow1','betaHow2','betaHow3','betaHow4'].map(k => (
                      <li key={k} dangerouslySetInnerHTML={{ __html: t(`dashboard.modals.${k}`) }} />
                    ))}
                  </ul>
                </section>

                <section>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('dashboard.modals.betaIncludes')}</div>
                  <ul style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['betaInc1','betaInc2','betaInc3','betaInc4','betaInc5','betaInc6','betaInc7'].map(k => (
                      <li key={k}>{t(`dashboard.modals.${k}`)}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}><AppIcon name="clock" size={12} /> {t('dashboard.modals.betaSoon')}</div>
                  <ul style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['betaSoon1','betaSoon2','betaSoon3','betaSoon4','betaSoon5','betaSoon6'].map(k => (
                      <li key={k} dangerouslySetInnerHTML={{ __html: t(`dashboard.modals.${k}`) }} />
                    ))}
                  </ul>
                </section>

                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
                  dangerouslySetInnerHTML={{ __html: t('dashboard.modals.betaFooter') }} />
              </div>

              {/* Peu fix */}
              <div style={{ padding: '16px 28px 22px', borderTop: '0.5px solid var(--color-border)' }}>
                <button onClick={() => setShowBetaModal(false)}
                  style={{ width: '100%', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-sans)' }}>
                  {t('common.understood')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAV */}
      <motion.nav className="dash-nav"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="dash-nav-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="dash-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>FindYour<span>Bet</span></div>
            {/* Botó BETA: obre el modal amb l'estat actual del producte, versió i roadmap */}
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowBetaModal(true)} title="Qué es FindYourBet y en qué punto está"
              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '0.5px solid var(--color-primary-border)', borderRadius: '999px', padding: '3px 10px', fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
              Beta
            </motion.button>
          </div>
          <div className="dash-nav-tabs">
            {shortcuts.map(item => {
              const key = scKey(item)
              if (item.type === 'tab') {
                const opt = SHORTCUT_OPTIONS.find(o => o.id === item.id)
                if (!opt) return null
                return (
                  <motion.button key={key}
                    className={`dash-tab ${tab === item.id ? 'active' : ''}`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setTab(item.id)}>
                    {t(opt.labelKey)}
                    {item.id === 'social' && unreadCount > 0 && (
                      <span style={{ marginLeft: '6px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    {item.id === 'canales' && unreadChannelCount > 0 && (
                      <span style={{ marginLeft: '6px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '1px 6px' }}>
                        {unreadChannelCount > 9 ? '9+' : unreadChannelCount}
                      </span>
                    )}
                  </motion.button>
                )
              }
              if (item.type === 'dm') {
                return (
                  <motion.button key={key}
                    className="dash-tab"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleStartDMExternal(item.userId)}
                    title={`@${item.username}`}>
                    <AppIcon name="social" size={12} style={{ marginRight: 3, opacity: 0.55, flexShrink: 0 }} />
                    {item.username}
                  </motion.button>
                )
              }
              if (item.type === 'channel') {
                return (
                  <motion.button key={key}
                    className="dash-tab"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNavigateToChannel({ invite_code: item.inviteCode })}
                    title={item.name}>
                    <AppIcon name={item.isPrivate ? 'lock' : 'canales'} size={12} style={{ marginRight: 3, opacity: 0.55, flexShrink: 0 }} />
                    {item.name}
                  </motion.button>
                )
              }
              return null
            })}
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setShowShortcutConfig(true)}
              title="Personalizar atajos"
              style={{ padding: '7px 10px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              <AppIcon name="edit" size={15} />
            </motion.button>
          </div>
        </div>
        <div className="dash-nav-right">
          {/* CAMPANA NOTIFICACIONS */}
          <div style={{ position: 'relative' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const next = !showNotifs; setShowNotifs(next); if (!next) markAllRead() }}
              style={{ background: showNotifs ? 'var(--color-bg-soft)' : 'none', border: '0.5px solid', borderColor: showNotifs ? 'var(--color-border)' : 'transparent', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center' }}>
              <AppIcon name="bell" size={18} />
            </motion.button>
            {notifCount > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--color-error)', color: '#fff', borderRadius: '999px', fontSize: '9px', fontWeight: 700, padding: '1px 5px', minWidth: '16px', textAlign: 'center', lineHeight: '14px', pointerEvents: 'none' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
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
          <LanguageSwitcher />
          <motion.button className="dash-tab" whileTap={{ scale: 0.98 }} onClick={() => { if (window.confirm(t('dashboard.nav.confirmSignOut'))) logout() }}>
            {t('dashboard.nav.signOut')}
          </motion.button>
        </div>
      </motion.nav>

      <div className="dash-layout">

        {/* SIDEBAR */}
        <aside className="dash-sidebar">
          <div className="sidebar-section">
            <button className="sidebar-item" onClick={() => setShowModal(true)}>
              <span className="sidebar-icon"><AppIcon name="newbet" size={15} /></span>
              {t('dashboard.nav.newPick')}
            </button>
          </div>
          {SIDEBAR.map(section => (
            <div key={section.labelKey} style={{ marginBottom: '8px' }}>
              <div className="sidebar-label">{t(section.labelKey)}</div>
              {section.items.map(item => (
                <div key={item.id} className="sidebar-section">
                  <button
                    className={`sidebar-item ${tab === item.id ? 'active' : ''}`}
                    onClick={() => setTab(item.id)}>
                    <span className="sidebar-icon"><AppIcon name={item.icon} size={15} /></span>
                    {t(item.labelKey)}
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
                <span className="sidebar-icon"><AppIcon name="admin" size={15} /></span>
                {t('dashboard.nav.controlCenter')}
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
        {/* overflow: visible per als tabs amb split view (canales, social) — els marges negatius del split s'han d'escapar sense ser retallats */}
        <div className="dash-content" style={(tab === 'canales' || tab === 'social') ? { overflow: 'visible' } : {}}>

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
                initialAction={pendingCanalAction}
                onActionUsed={() => setPendingCanalAction(null)}
                onAddBet={handleAddBetFromCanal}
                unreadChannelCounts={unreadChannelCounts}
                onActiveUnreadChange={setChannelUnreadCount}
                onActiveChannelChange={setActiveChannelUnread}
                onRefreshUnread={refetchChannelUnread}
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
              <Tipsters key={tipstersKey} user={user} onNavigateToChannel={handleNavigateToChannel} onStartDM={handleStartDMExternal} onRefreshUser={onRefreshUser} />
            </div>
          )}

          {visited.has('social') && (
            <div style={{ display: tab === 'social' ? 'block' : 'none' }}>
              <Social key={socialKey} user={user} initialDMUserId={pendingSocialDMUserId} onNavigateToChannel={handleNavigateToChannel} onActiveUnreadChange={setDmUnreadCount} onRefreshUnread={refetchDmUnread} />
            </div>
          )}

          {visited.has('ranking') && (
            <div style={{ display: tab === 'ranking' ? 'block' : 'none' }}>
              <Ranking key={rankingKey} user={user} onNavigateToChannel={handleNavigateToChannel} />
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
            <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AppIcon name="loading" size={14} /> Cargando panel...</div>}>
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', padding: '20px', boxSizing: 'border-box' }}>
            <ProfileView
              userId={notifProfileUserId}
              currentUser={user}
              onBack={() => setNotifProfileUserId(null)}
              onStartDM={(userId) => { setNotifProfileUserId(null); handleStartDMExternal(userId) }}
              isFollowing={globalFollow.isFollowing(notifProfileUserId)}
              isFollower={globalFollow.isFollower(notifProfileUserId)}
              onFollow={(uid) => globalFollow.follow(uid, user?.name || 'alguien')}
              onUnfollow={(uid) => globalFollow.unfollow(uid)}
              onNavigateToChannel={(ch) => { setNotifProfileUserId(null); handleNavigateToChannel(ch) }}
              onViewUser={(uid) => setNotifProfileUserId(uid)}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
    </ProfileNavContext.Provider>
    </AdminModeProvider>
  )
}
