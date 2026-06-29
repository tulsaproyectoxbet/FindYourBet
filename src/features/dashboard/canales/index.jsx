import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { stagger } from '../../../lib/animations'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { useChannels } from './hooks/useChannels'
import ChannelCard from './ChannelCard'
import LeaveChannelModal from './LeaveChannelModal'
import ChatView from './ChatView'
import PreviewView from './PreviewView'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { isAdminUserId } from '../../../lib/adminUsers'
import { commissionRate, COMMISSION_BANDS, MIN_ACCESS_PRICE } from '../../../lib/commission'
import { formatMsgPreview } from '../../../lib/formatMsgPreview'
import { usePinnedChannels } from '../../../hooks/usePinnedChannels'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import { useResizablePanel } from '../../../hooks/useResizablePanel'
import '../dashboard.css'

function miniTimeAgo(ts) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }

// Períodes VIP disponibles. 'vip_custom' demana dates concretes al tipster.
const VIP_PERIODS = [
  { id: 'vip_monthly',   label: 'Mensual',       desc: 'Acceso de 1 mes' },
  { id: 'vip_weekly',    label: 'Semanal',       desc: 'Acceso de 1 semana' },
  { id: 'vip_quarterly', label: 'Trimestral',    desc: 'Acceso de 3 meses' },
  { id: 'vip_yearly',    label: 'Anual',         desc: 'Acceso de 1 año' },
  { id: 'vip_custom',    label: 'Personalizado', desc: 'Tú eliges las fechas' },
]
const PAID_CHANNEL_TYPES = ['vip_weekly', 'vip_monthly', 'vip_quarterly', 'vip_yearly', 'vip_custom', 'stakazo']

// Estil compartit de fila/targeta seleccionable del flux de creació.
const selectableRow = (active) => ({
  display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px',
  borderRadius: 'var(--radius-md)', border: `0.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
  background: active ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.15s',
})
const RadioDot = ({ active }) => (
  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'var(--color-primary)' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#010906' }} />}
  </div>
)

// Resol el channel_type final a partir de la selecció en cascada del formulari.
function resolveChannelType(f) {
  if (f.privacy === 'public') return 'public'
  if (f.privacy === 'private') {
    if (f.privateKind === 'free_private') return 'free_private'
    if (f.privateKind === 'stakazo') return 'stakazo'
    if (f.privateKind === 'vip') return f.vipPeriod || null
  }
  return null
}

export default function Canales({ user, initialCanalCode, onCanalCodeUsed, onAddBet, unreadChannelCounts = new Map(), onActiveUnreadChange, onRefreshUnread }) {
  const { adminMode } = useAdminMode()
  const { myChannels, joinedChannels, memberCounts, lastMessages, loading, createChannel, deleteChannel, updateChannel, searchChannels, findChannelByCode, joinChannel, leaveChannel, refetch, MAX_OWN_CHANNELS, MAX_JOINED_CHANNELS } = useChannels(user)
  const { pin, unpin, isPinned } = usePinnedChannels('fyb_pinned_channels')
  const { mute, unmute, isMuted } = useMutes()
  const { pct: miniPct, containerRef: splitRef, onResizerMouseDown } = useResizablePanel('fyb_panel_width_channels')
  const [activeChannel, setActiveChannel] = useState(null)
  const [activeMemberCount, setActiveMemberCount] = useState(0)
  const [previewChannel, setPreviewChannel] = useState(null)
  const [previewMemberCount, setPreviewMemberCount] = useState(0)
  const [joiningPreview, setJoiningPreview] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [suggestedChannels, setSuggestedChannels] = useState([])
  // Selecció en cascada: privacy (public/private) → privateKind (free_private/vip/stakazo)
  // → vipPeriod (vip_weekly/monthly/quarterly/yearly/custom). El channel_type final
  // es resol a resolveChannelType(). customStart/customEnd només per a 'vip_custom'.
  const [createForm, setCreateForm] = useState({
    name: '', description: '', privacy: '', privateKind: '', vipPeriod: '',
    customStart: '', customEnd: '', price: '', discountPrice: '',
  })
  const [createError, setCreateError] = useState('')
  const [showCommissionGuide, setShowCommissionGuide] = useState(false)
  const [calcPrice, setCalcPrice] = useState('')
  const [confirmCreate, setConfirmCreate] = useState(false)
  const isVerified = !!user?.is_verified
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [filterSport, setFilterSport] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('')
  const [sortBy, setSortBy] = useState('score')
  const [showFilters, setShowFilters] = useState(false)
  const [miniMenuId, setMiniMenuId] = useState(null)
  const [miniMuteId, setMiniMuteId] = useState(null)
  const [leaveTarget, setLeaveTarget] = useState(null) // { id, name }

  // Sortida de canal: la primera vegada (o sempre) es confirma amb modal. Si l'usuari
  // marca "No volver a preguntar", desem la preferència i les pròximes sortides són directes.
  const LEAVE_SKIP_KEY = 'fyb_skip_leave_confirm'
  const performLeave = (channelId) => {
    leaveChannel(channelId)
    if (activeChannel?.id === channelId) closeActiveChannel()
  }
  const requestLeave = (channelId, channelName) => {
    if (localStorage.getItem(LEAVE_SKIP_KEY) === '1') { performLeave(channelId); return }
    setLeaveTarget({ id: channelId, name: channelName })
  }

  useEffect(() => {
    if (!initialCanalCode || loading) return
    onCanalCodeUsed?.()
    handleOpenByCode(initialCanalCode)
  }, [initialCanalCode, loading])

  const handleOpenByCode = async (code) => {
    const channel = await findChannelByCode(code)
    if (!channel) return
    const isMember = joinedChannels.some(j => j.id === channel.id) || myChannels.some(m => m.id === channel.id)
    if (isMember) { handleOpenChannel(channel); return }
    if (channel.is_private) {
      const result = await joinChannel(channel.id)
      if (!result?.error) { await refetch(); handleOpenChannel(channel) }
      return
    }
    await handlePreviewChannel(channel)
  }

  const handleOpenChannel = (channel) => {
    setActiveMemberCount(memberCounts[channel.id] || 1)
    setActiveChannel(channel)
    // Ja NO marquem tot el canal com llegit en obrir. Els no llegits baixen a mesura
    // que l'usuari veu els missatges (ChatView reporta via onActiveUnreadChange).
  }

  // En tancar un canal, reconcilia el recompte global de no llegits amb el servidor.
  const closeActiveChannel = () => {
    setActiveChannel(null)
    onRefreshUnread?.()
  }

  const handlePreviewChannel = async (channel) => {
    // Exclou admins (fyourbet) del recompte
    const { data: mems } = await supabase
      .from('channel_members').select('user_id')
      .eq('channel_id', channel.id)
    const count = (mems || []).filter(m => !isAdminUserId(m.user_id)).length
    setPreviewMemberCount(count + 1) // owner sempre compta, inclòs fyourbet als seus canals
    setPreviewChannel(channel)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleJoinFromPreview = async () => {
    if (!previewChannel) return
    setJoiningPreview(true)
    const result = await joinChannel(previewChannel.id)
    setJoiningPreview(false)
    if (result?.error) return
    setActiveMemberCount(previewMemberCount)
    setActiveChannel(previewChannel)
    setPreviewChannel(null)
    await refetch()
  }

  const handleCreate = async () => {
    setCreateError('')
    const channelType = resolveChannelType(createForm)
    if (!channelType) { setCreateError('Selecciona el tipo de canal'); return }
    const result = await createChannel(
      createForm.name,
      createForm.description,
      channelType,
      createForm.price || null,
      createForm.discountPrice || null,
      createForm.customStart || null,
      createForm.customEnd || null,
    )
    if (result?.error) { setCreateError(result.error); return }
    setCreateForm({ name: '', description: '', privacy: '', privateKind: '', vipPeriod: '', customStart: '', customEnd: '', price: '', discountPrice: '' })
    setShowCreate(false)
  }

  // Exclou canals on l'usuari ja és propietari o membre — no apareixen ni com a suggerits ni als resultats.
  // En mode admin no es filtra res — pot veure tots els canals existents.
  const filterOutJoined = (channels) => {
    if (adminMode) return channels || []
    const joinedIds = new Set([
      ...(myChannels || []).map(c => c.id),
      ...(joinedChannels || []).map(c => c.id),
    ])
    return (channels || []).filter(c => !joinedIds.has(c.id))
  }

  const runSearch = async ({ query = searchQuery, sport = filterSport, language = filterLanguage, sort = sortBy } = {}) => {
    setSearching(true)
    const results = filterOutJoined(await searchChannels(query, { sport, language, sortBy: sort, includePrivate: adminMode }))
    if (query.trim() || sport || language) {
      setSearchResults(results)
    } else {
      setSuggestedChannels(results)
      setSearchResults([])
    }
    setSearching(false)
  }

  const handleOpenSearch = async () => {
    setShowSearch(true)
    setShowCreate(false)
    setSearching(true)
    const results = filterOutJoined(await searchChannels('', { sport: filterSport, language: filterLanguage, sortBy: sortBy, includePrivate: adminMode }))
    setSuggestedChannels(results)
    setSearching(false)
  }

  const handleSearch = async (q) => {
    setSearchQuery(q)
    setJoinError('')
    await runSearch({ query: q })
  }

  const handleFilterSport = async (sport) => {
    setFilterSport(sport)
    await runSearch({ sport })
  }

  const handleFilterLanguage = async (language) => {
    setFilterLanguage(language)
    await runSearch({ language })
  }

  const handleSortBy = async (sort) => {
    setSortBy(sort)
    await runSearch({ sort })
  }

  const handleJoinByCode = async () => {
    const input = inviteCode.trim()
    if (!input) return
    setInviteError('')
    setInviteLoading(true)

    // Detecta si és un link personal (/acceso/UUID) o directament un UUID token
    const accesoMatch = input.match(/\/acceso\/([a-f0-9-]{36})/i)
    const uuidMatch = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input)
    const token = accesoMatch?.[1] || (uuidMatch ? input : null)

    if (token) {
      // Valida el token contra el compte de l'usuari actual
      const { data: purchase } = await supabase
        .from('purchases')
        .select('channel_id, channels(id, name, invite_code, is_private, channel_type, owner_id, description, avatar_url, duration_start, duration_end)')
        .eq('token', token)
        .eq('user_id', user.id)
        .maybeSingle()

      setInviteLoading(false)
      setInviteCode('')

      if (!purchase?.channels) {
        setInviteError(`Este enlace no es válido para tu cuenta (${user.email}). Si compraste con otro email, inicia sesión con ese email o contacta con fyourbet@gmail.com`)
        return
      }

      const channel = purchase.channels
      setShowSearch(false)
      // L'usuari ja és membre (el webhook l'ha afegit); obre el canal directament
      await refetch()
      handleOpenChannel(channel)
      return
    }

    // Flux normal: codi d'invitació de 8 caràcters
    const channel = await findChannelByCode(input)
    if (!channel) {
      setInviteError('Código de invitación no válido')
      setInviteLoading(false)
      return
    }
    const isAlreadyMember = joinedChannels.some(j => j.id === channel.id) || myChannels.some(m => m.id === channel.id)
    if (isAlreadyMember) {
      setInviteLoading(false)
      setInviteCode('')
      setShowSearch(false)
      handleOpenChannel(channel)
      return
    }
    // Canal privat → unir directament sense preview
    if (channel.is_private) {
      const result = await joinChannel(channel.id)
      setInviteLoading(false)
      setInviteCode('')
      setShowSearch(false)
      if (result?.error) { setInviteError(result.error); return }
      await refetch()
      handleOpenChannel(channel)
      return
    }
    // Canal públic → mostrar preview
    await handlePreviewChannel(channel)
    setInviteLoading(false)
    setInviteCode('')
  }

  // Ordena canals: ancorats primer, després per missatge més recent.
  const sortByRecent = (channels) =>
    channels.slice().sort((a, b) => {
      const aPin = isPinned(a.id), bPin = isPinned(b.id)
      if (aPin && !bPin) return -1
      if (!aPin && bPin) return 1
      const tA = lastMessages[a.id]?.created_at || a.created_at || ''
      const tB = lastMessages[b.id]?.created_at || b.created_at || ''
      return tB > tA ? 1 : tB < tA ? -1 : 0
    })

  const ownedSorted = sortByRecent(myChannels.map(c => ({ ...c, _isOwner: true })))
  const joinedSorted = sortByRecent(joinedChannels.map(c => ({ ...c, _isOwner: false })))
  const focusedId = activeChannel?.id || previewChannel?.id
  const canCreateMore = myChannels.length < MAX_OWN_CHANNELS

  // Mentre s'obre un canal via link, mostra placeholder lleuger sense flash de la llista
  if (initialCanalCode && !activeChannel && !previewChannel) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Abriendo canal...
      </div>
    )
  }

  const miniActionBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '3px 7px', borderRadius: 'var(--radius-sm)', lineHeight: 1, transition: 'color 0.15s', fontFamily: 'var(--font-sans)' }

  return (
    <div className="canales-split" ref={splitRef}>

      {/* 75% — contingut: chat actiu / crear / buscar / placeholder */}
      <div className="canales-chat-panel">
        {activeChannel ? (
          <ChatView
            channel={activeChannel}
            user={user}
            onBack={closeActiveChannel}
            memberCount={activeMemberCount}
            onLeave={() => requestLeave(activeChannel.id, activeChannel.name)}
            onDeleteChannel={async (channelId) => { await deleteChannel(channelId); closeActiveChannel() }}
            onOpenCanal={handleOpenByCode}
            onAddBet={onAddBet}
            onChannelUpdated={(updated) => { updateChannel(updated); setActiveChannel(updated) }}
            onUnreadChange={onActiveUnreadChange}
            compact
          />
        ) : previewChannel ? (() => {
          const isAlreadyMember = joinedChannels.some(j => j.id === previewChannel.id) || myChannels.some(m => m.id === previewChannel.id)
          return isAlreadyMember
            ? <ChatView channel={previewChannel} user={user} onBack={() => setPreviewChannel(null)} memberCount={previewMemberCount} onOpenCanal={handleOpenByCode} onAddBet={onAddBet} compact />
            : <PreviewView channel={previewChannel} user={user} onBack={() => setPreviewChannel(null)} onJoin={handleJoinFromPreview} joining={joiningPreview} memberCount={previewMemberCount} compact />
        })()
        : showCreate ? (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 36px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Crear canal</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setCreateError(''); setConfirmCreate(false) }}>✕ Cerrar</Button>
            </div>
            {createError && (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '14px' }}>
                {createError}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Nombre *</label>
              <input type="text" placeholder="ej. MarcGol Tips" value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                maxLength={30} style={inputStyle} />
              <div style={{ fontSize: '11px', color: createForm.name.length > 25 ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{createForm.name.length}/30</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Descripción (opcional)</label>
              <input type="text" placeholder="De qué va tu canal..." value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                maxLength={200} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Tipo de canal *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'public',  icon: '🌐', label: 'Público',  desc: 'Visible en búsqueda y ranking' },
                  { id: 'private', icon: '🔒', label: 'Privado', desc: 'Por enlace o de pago' },
                ].map(o => {
                  const active = createForm.privacy === o.id
                  return (
                    <div key={o.id} onClick={() => setCreateForm({ ...createForm, privacy: o.id, privateKind: '', vipPeriod: '', price: '', discountPrice: '', customStart: '', customEnd: '' })}
                      style={{ ...selectableRow(active), flex: 1, flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '20px' }}>{o.icon}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{o.label}</div>
                    </div>
                  )
                })}
              </div>
              {createForm.privacy === 'private' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {[
                    { id: 'free_private', icon: '🆓', label: 'Privado gratuito', desc: 'Acceso solo por enlace. No aparece en ningún ranking.' },
                    { id: 'vip',          icon: '📅', label: 'VIP',              desc: 'Subscripción de pago con duración.' },
                    { id: 'stakazo',      icon: '⚡', label: 'Stakazo',          desc: 'Pick puntual de pago. Aparece en el Top Stakazos.' },
                  ].map(o => {
                    const active = createForm.privateKind === o.id
                    return (
                      <div key={o.id} onClick={() => setCreateForm({ ...createForm, privateKind: o.id, vipPeriod: '', price: '', discountPrice: '', customStart: '', customEnd: '' })}
                        style={selectableRow(active)}>
                        <RadioDot active={active} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{o.icon} {o.label}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {createForm.privacy === 'private' && createForm.privateKind === 'vip' && (
                <div style={{ marginTop: '12px', paddingLeft: '4px' }}>
                  <label style={{ ...labelStyle, marginBottom: '6px' }}>Duración del VIP *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {VIP_PERIODS.map(o => {
                      const active = createForm.vipPeriod === o.id
                      return (
                        <div key={o.id} onClick={() => setCreateForm({ ...createForm, vipPeriod: o.id, customStart: '', customEnd: '' })}
                          style={selectableRow(active)}>
                          <RadioDot active={active} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{o.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {createForm.vipPeriod === 'vip_custom' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Inicio</label>
                        <input type="date" value={createForm.customStart}
                          onChange={e => setCreateForm({ ...createForm, customStart: e.target.value })}
                          style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Fin</label>
                        <input type="date" value={createForm.customEnd} min={createForm.customStart || undefined}
                          onChange={e => setCreateForm({ ...createForm, customEnd: e.target.value })}
                          style={inputStyle} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {(createForm.privateKind === 'stakazo' || (createForm.privateKind === 'vip' && createForm.vipPeriod)) && (
              <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Precio de acceso * (EUR)</label>
                    <button type="button" onClick={() => setShowCommissionGuide(v => !v)} title="Cómo funciona la comisión"
                      style={{ width: '18px', height: '18px', borderRadius: '50%', border: `0.5px solid ${showCommissionGuide ? 'var(--color-primary)' : 'var(--color-border)'}`, background: showCommissionGuide ? 'var(--color-primary-light)' : 'var(--color-bg)', color: showCommissionGuide ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>
                      i
                    </button>
                  </div>
                  <AnimatePresence>
                    {showCommissionGuide && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '10px' }}>Tabla de comisiones</div>
                          <div style={{ display: 'flex', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '4px', borderBottom: '0.5px solid var(--color-border)' }}>
                            <span style={{ flex: 1 }}>Precio</span>
                            <span style={{ width: '72px', textAlign: 'right' }}>Comisión</span>
                            <span style={{ width: '72px', textAlign: 'right' }}>Recibes</span>
                          </div>
                          {COMMISSION_BANDS.map(b => {
                            const rate = isVerified ? b.rate - 0.05 : b.rate
                            return (
                              <div key={b.min} style={{ display: 'flex', fontSize: '11px', color: 'var(--color-text)', padding: '4px 0' }}>
                                <span style={{ flex: 1 }}>{b.label}</span>
                                <span style={{ width: '72px', textAlign: 'right', color: 'var(--color-warning)', fontWeight: 600 }}>{Math.round(rate * 100)}%</span>
                                <span style={{ width: '72px', textAlign: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>{Math.round((1 - rate) * 100)}%</span>
                              </div>
                            )
                          })}
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--color-border)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Calculadora</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <input type="number" min={MIN_ACCESS_PRICE} step="0.5" placeholder="Precio" value={calcPrice}
                                  onChange={e => setCalcPrice(e.target.value)}
                                  style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '6px 24px 6px 8px', borderRadius: 'var(--radius-sm)', outline: 'none', boxSizing: 'border-box' }} />
                                <span style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--color-text-muted)' }}>€</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>→</span>
                              {(() => {
                                const p = parseFloat(calcPrice)
                                if (!p || p < MIN_ACCESS_PRICE) return <span style={{ flex: 1, fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>— €</span>
                                const rate = commissionRate(p, isVerified)
                                const net = (p * (1 - rate)).toFixed(2).replace('.', ',')
                                return <span style={{ flex: 1, fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)' }}>{net} €</span>
                              })()}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <input type="number" min={MIN_ACCESS_PRICE} step="0.5" placeholder="ej. 9.99"
                    value={createForm.price}
                    onChange={e => setCreateForm({ ...createForm, price: e.target.value })}
                    style={{ ...inputStyle }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '16px', fontSize: '12px', color: 'var(--color-warning)', fontWeight: 600 }}>
              <span>⚠️</span>
              <span>El tipo de canal no se puede cambiar una vez creado.</span>
            </div>
            <label onClick={() => setConfirmCreate(v => !v)}
              style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', background: confirmCreate ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', border: `0.5px solid ${confirmCreate ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', marginBottom: '14px', cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${confirmCreate ? 'var(--color-primary)' : 'var(--color-border)'}`, background: confirmCreate ? 'var(--color-primary)' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {confirmCreate && <span style={{ color: '#010906', fontSize: '12px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '12px', color: confirmCreate ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.6 }}>
                He revisado los datos introducidos y son correctos. Entiendo que como tipster <strong>soy responsable del contenido que publique</strong> y del impacto que tiene en los miembros de mi canal.
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={handleCreate}
                disabled={
                  !createForm.name.trim() ||
                  !resolveChannelType(createForm) ||
                  (PAID_CHANNEL_TYPES.includes(resolveChannelType(createForm)) && !createForm.price) ||
                  (createForm.vipPeriod === 'vip_custom' && (!createForm.customStart || !createForm.customEnd)) ||
                  !confirmCreate
                }>
                Crear canal
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError(''); setConfirmCreate(false) }}>Cancelar</Button>
            </div>
          </div>

        ) : showSearch ? (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 36px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Buscar canales</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}>✕ Cerrar</Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', position: 'relative' }}>
              <input type="text" placeholder="Busca por nombre del canal..."
                value={searchQuery} onChange={e => handleSearch(e.target.value)}
                maxLength={50} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setShowFilters(v => !v)}
                  style={{ height: '100%', padding: '0 14px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${(filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary)' : 'var(--color-border)'}`, background: (filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: (filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                  🎛 Filtros
                </button>
                <AnimatePresence>
                  {showFilters && (
                    <>
                      <div onClick={() => setShowFilters(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                      <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 10, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '16px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Deporte</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {['', 'Fútbol', 'Baloncesto', 'Tenis', 'eSports', 'MMA', 'Otros'].map(s => (
                              <button key={s} onClick={() => handleFilterSport(s)}
                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${filterSport === s ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filterSport === s ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: filterSport === s ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: filterSport === s ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {s || 'Todos'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Idioma</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[['', 'Todos'], ['Español', 'ES'], ['Català', 'CAT'], ['English', 'EN'], ['Português', 'PT'], ['Français', 'FR'], ['Deutsch', 'DE']].map(([val, label]) => (
                              <button key={val} onClick={() => handleFilterLanguage(val)}
                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${filterLanguage === val ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filterLanguage === val ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: filterLanguage === val ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: filterLanguage === val ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Ordenar</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[['score', 'Relevancia'], ['yield', 'Mejor yield'], ['members', 'Más miembros'], ['winRate', '% acierto']].map(([val, label]) => (
                              <button key={val} onClick={() => handleSortBy(val)}
                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${sortBy === val ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sortBy === val ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: sortBy === val ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: sortBy === val ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>🔒 Código de invitación (canal privado)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="Código o enlace de acceso personal" value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setInviteError('') }}
                  maxLength={200} style={{ ...inputStyle, width: 'auto', flex: 1 }} />
                <Button size="sm" disabled={!inviteCode.trim() || inviteLoading} onClick={handleJoinByCode}>
                  {inviteLoading ? '...' : 'Acceder'}
                </Button>
              </div>
              {inviteError && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '6px' }}>{inviteError}</div>}
            </div>
            {joinError && (
              <div style={{ background: 'var(--color-error-light)', color: 'var(--color-error)', padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '12px' }}>
                {joinError}
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>Buscando...</div>}
            {!searching && (() => {
              const hasActiveFilter = searchQuery.trim() || filterSport || filterLanguage
              const list = hasActiveFilter ? searchResults : suggestedChannels
              if (list.length === 0 && hasActiveFilter) return (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', paddingTop: '8px' }}>No se encontraron canales con estos filtros</div>
              )
              if (list.length === 0) return null
              return (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    {hasActiveFilter ? `${list.length} resultado${list.length !== 1 ? 's' : ''}` : '🔥 Canales sugeridos'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {list.map((c, idx) => {
                      const alreadyJoined = joinedChannels.some(j => j.id === c.id)
                      const isOwn = myChannels.some(m => m.id === c.id)
                      const prof = c.ownerProfile
                      const stats = c.ownerStats
                      const initial = (prof?.username || c.name || '?')[0].toUpperCase()
                      return (
                        <div key={c.id} onClick={() => handlePreviewChannel(c)}
                          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg)' }}>
                            {prof?.avatar_url ? <img src={prof.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: '14px' }}>#{c.name}</span>
                              {idx === 0 && !hasActiveFilter && <span style={{ fontSize: '10px', background: 'var(--color-primary)', color: '#010906', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 700 }}>TOP</span>}
                              {c.sport && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>{c.sport}</span>}
                              {c.language && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>{c.language}</span>}
                            </div>
                            {prof?.username && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{prof.username}</div>}
                            {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.description}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              <span>👥</span><span>{c.memberCount}</span>
                            </div>
                            {stats.total > 0 && (
                              <>
                                <div style={{ fontSize: '11px', color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 700 }}>
                                  {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}% yield
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{stats.winRate.toFixed(0)}% acierto</div>
                              </>
                            )}
                            {alreadyJoined || isOwn
                              ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Unido ✓</span>
                              : <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700 }}>Ver →</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>

        ) : (
          // Placeholder quan no hi ha cap canal obert ni acció activa
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '12px', textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '52px', opacity: 0.25 }}>📡</div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)', opacity: 0.7 }}>Selecciona un canal</div>
            <div style={{ fontSize: '13px', maxWidth: '240px' }}>
              {myChannels.length + joinedChannels.length > 0
                ? 'Elige un canal de la lista para abrirlo.'
                : 'Crea tu primer canal o únete a uno existente.'}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button variant="ghost" size="sm" onClick={handleOpenSearch}>🔍 Buscar canal</Button>
              {canCreateMore && <Button size="sm" onClick={() => { setShowCreate(true); setShowSearch(false) }}>+ Crear canal</Button>}
            </div>
          </div>
        )}
      </div>

      {/* Resizer arrossegable */}
      <div className="canales-resizer" onMouseDown={onResizerMouseDown} />

      {/* Mini channel list — dreta */}
      <div className="canales-mini-list" style={{ width: `${miniPct}%` }}>

        {/* Llista de canals */}
        {[
          { label: 'Mis canales', channels: ownedSorted },
          { label: 'Unidos', channels: joinedSorted },
        ].map(({ label, channels }) => channels.length === 0 ? null : (
          <div key={label}>
            <div className="canales-mini-section">{label}</div>
            {channels.map(ch => {
              const unread = unreadChannelCounts?.get?.(ch.id) || 0
              const isActive = ch.id === focusedId
              const lastMsg = lastMessages[ch.id] || null
              const preview = lastMsg ? formatMsgPreview(lastMsg.content) : (ch.description || '')
              const timeStr = miniTimeAgo(lastMsg?.created_at || ch.created_at)
              const chMuteKey = `channel_${ch.id}`
              const chMuted = isMuted(chMuteKey)
              const chPinned = isPinned(ch.id)
              const menuOpen = miniMenuId === ch.id
              const muteOpen = miniMuteId === ch.id
              const miniMenuBtnStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)', gap: '6px' }
              return (
                <div key={ch.id} className={`canales-mini-item${isActive ? ' active' : ''}`}>
                  <div onClick={() => handleOpenChannel(ch)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <div className="canales-mini-avatar"
                      style={{ background: ch._isOwner ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: ch._isOwner ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                      {ch.avatar_url
                        ? <img src={ch.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : ch.name[0].toUpperCase()}
                      {unread > 0 && (
                        <div style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '16px', height: '16px', background: 'var(--color-error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', border: '2px solid var(--color-bg)', padding: '0 2px', boxSizing: 'border-box' }}>
                          {unread > 9 ? '9+' : unread}
                        </div>
                      )}
                    </div>
                    <div className="canales-mini-body">
                      <div className="canales-mini-row">
                        <span className="canales-mini-name">
                          {chPinned && <span style={{ fontSize: '10px', marginRight: '3px' }}>📌</span>}
                          {ch.name}
                        </span>
                        <span className="canales-mini-time">{timeStr}</span>
                      </div>
                      <div className="canales-mini-preview">
                        {chMuted && <span style={{ marginRight: '4px' }}>🔕</span>}
                        {preview || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Sin mensajes</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center' }}>
                    <button className="canales-mini-dots"
                      onClick={e => { e.stopPropagation(); setMiniMenuId(menuOpen ? null : ch.id); setMiniMuteId(null) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', padding: '2px 5px', borderRadius: 'var(--radius-sm)', fontWeight: 700, lineHeight: 1, opacity: menuOpen ? 1 : undefined }}>
                      ⋮
                    </button>
                    <AnimatePresence>
                      {menuOpen && (
                        <>
                          <div onClick={() => setMiniMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                          <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                            style={{ position: 'absolute', top: '26px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '175px', overflow: 'hidden' }}>
                            <button onClick={() => { chPinned ? unpin(ch.id) : pin(ch.id); setMiniMenuId(null) }}
                              style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                              {chPinned ? '📍 Desanclar' : '📌 Anclar'}
                            </button>
                            <button onClick={() => {
                              if (chMuted) { unmute(chMuteKey); setMiniMenuId(null) }
                              else { setMiniMuteId(ch.id); setMiniMenuId(null) }
                            }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                              {chMuted ? '🔔 Activar notificaciones' : '🔕 Silenciar'}
                            </button>
                            <button onClick={() => {
                              if (ch._isOwner) {
                                if (window.confirm(`¿Eliminar el canal "${ch.name}"? Esta acción es irreversible y eliminará todos los mensajes.`)) {
                                  deleteChannel(ch.id)
                                  if (activeChannel?.id === ch.id) setActiveChannel(null)
                                }
                              } else {
                                requestLeave(ch.id, ch.name)
                              }
                              setMiniMenuId(null)
                            }} style={{ ...miniMenuBtnStyle, color: 'var(--color-error)' }}>
                              {ch._isOwner ? '🗑️ Eliminar canal' : '🚪 Salir del canal'}
                            </button>
                          </motion.div>
                        </>
                      )}
                      {muteOpen && (
                        <>
                          <div onClick={() => setMiniMuteId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                          <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                            style={{ position: 'absolute', top: '26px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '155px', overflow: 'hidden' }}>
                            {MUTE_DURATIONS.map((d, i) => (
                              <button key={i} onClick={() => { mute(chMuteKey, d.ms); setMiniMuteId(null) }}
                                style={{ ...miniMenuBtnStyle, borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
                                {d.label}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {!loading && ownedSorted.length === 0 && joinedSorted.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Sin canales todavía
          </div>
        )}
      </div>

      <AnimatePresence>
        {leaveTarget && (
          <LeaveChannelModal
            channelName={leaveTarget.name}
            onConfirm={(dontAsk) => {
              if (dontAsk) localStorage.setItem(LEAVE_SKIP_KEY, '1')
              performLeave(leaveTarget.id)
              setLeaveTarget(null)
            }}
            onClose={() => setLeaveTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}