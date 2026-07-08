import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { stagger } from '../../../lib/animations'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import AppIcon from '../../../components/ui/AppIcon'
import { useChannels } from './hooks/useChannels'
import ChannelCard from './ChannelCard'
import LeaveChannelModal from './LeaveChannelModal'
import ChatView from './ChatView'
import PreviewView from './PreviewView'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { isAdminUserId } from '../../../lib/adminUsers'
import { formatMsgPreview } from '../../../lib/formatMsgPreview'
import { usePinnedChannels } from '../../../hooks/usePinnedChannels'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import { useResizablePanel } from '../../../hooks/useResizablePanel'
import '../dashboard.css'

function miniTimeAgo(ts, t) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return t('canales.now')
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
}

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }

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

function resolveChannelType(f) {
  if (f.privacy === 'public') return 'public'
  if (f.privacy === 'private') return 'free_private'
  return null
}

export default function Canales({ user, initialCanalCode, onCanalCodeUsed, initialAction, onActionUsed, onAddBet, unreadChannelCounts = new Map(), onActiveUnreadChange, onActiveChannelChange, onRefreshUnread }) {
  const { t } = useTranslation()
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
  const [createForm, setCreateForm] = useState({ name: '', description: '', privacy: '' })
  const [createError, setCreateError] = useState('')
  const [confirmCreate, setConfirmCreate] = useState(false)
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

  useEffect(() => {
    if (!initialAction || loading) return
    onActionUsed?.()
    if (initialAction === 'buscar') handleOpenSearch()
    if (initialAction === 'crear') { setShowCreate(true); setShowSearch(false) }
  }, [initialAction, loading])

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
    // Informa useUnreadChannelCount quin canal és actiu perquè fetchUnread no sobreescrigui
    // el recompte live de ChatView amb dades de localStorage desfasades (evita flash de badge).
    onActiveChannelChange?.(channel.id)
  }

  // En tancar un canal, reconcilia el recompte global de no llegits amb el servidor.
  const closeActiveChannel = () => {
    setActiveChannel(null)
    onActiveChannelChange?.(null)
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
    if (!channelType) { setCreateError(t('canales.selectType')); return }
    const result = await createChannel(createForm.name, createForm.description, channelType)
    if (result?.error) { setCreateError(result.error); return }
    setCreateForm({ name: '', description: '', privacy: '' })
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

    // Codi d'invitació de 8 caràcters
    const channel = await findChannelByCode(input)
    if (!channel) {
      setInviteError(t('canales.invalidCode'))
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
        {t('canales.opening')}
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
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{t('canales.createTitle')}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setCreateError(''); setConfirmCreate(false) }}><AppIcon name="close" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('common.close')}</Button>
            </div>
            {createError && (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '14px' }}>
                {createError}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>{t('betModal.nameLabel')}</label>
              <input type="text" placeholder={t('betModal.namePlaceholder')} value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                maxLength={30} style={inputStyle} />
              <div style={{ fontSize: '11px', color: createForm.name.length > 25 ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{createForm.name.length}/30</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>{t('betModal.descLabel')}</label>
              <input type="text" placeholder={t('betModal.descPlaceholder')} value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                maxLength={200} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>{t('canales.channelType')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'public',  iconName: 'globe', labelKey: 'canales.typePublic',  descKey: 'canales.typePublicDesc' },
                  { id: 'private', iconName: 'lock',  labelKey: 'canales.typePrivate', descKey: 'canales.typePrivateDesc' },
                ].map(o => {
                  const active = createForm.privacy === o.id
                  return (
                    <div key={o.id} onClick={() => setCreateForm({ ...createForm, privacy: o.id })}
                      style={{ ...selectableRow(active), flex: 1, flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}><AppIcon name={o.iconName} size={22} /></div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{t(o.labelKey)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t(o.descKey)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '16px', fontSize: '12px', color: 'var(--color-warning)', fontWeight: 600 }}>
              <AppIcon name="warning" size={13} />
              <span>{t('canales.typeWarning')}</span>
            </div>
            <label onClick={() => setConfirmCreate(v => !v)}
              style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', background: confirmCreate ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', border: `0.5px solid ${confirmCreate ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', marginBottom: '14px', cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${confirmCreate ? 'var(--color-primary)' : 'var(--color-border)'}`, background: confirmCreate ? 'var(--color-primary)' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {confirmCreate && <AppIcon name="check" size={12} color="#010906" />}
              </div>
              <span style={{ fontSize: '12px', color: confirmCreate ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.6 }}>
                {t('canales.confirmPre')} <strong>{t('canales.confirmBold')}</strong> {t('canales.confirmPost')}
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={handleCreate}
                disabled={!createForm.name.trim() || !resolveChannelType(createForm) || !confirmCreate}>
                {t('canales.createBtn')}
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError(''); setConfirmCreate(false) }}>{t('common.cancel')}</Button>
            </div>
          </div>

        ) : showSearch ? (
          <div style={{ height: '100%', overflowY: 'auto', padding: '32px 36px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{t('canales.searchTitle')}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}><AppIcon name="close" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('common.close')}</Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', position: 'relative' }}>
              <input type="text" placeholder={t('canales.searchPlaceholder')}
                value={searchQuery} onChange={e => handleSearch(e.target.value)}
                maxLength={50} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setShowFilters(v => !v)}
                  style={{ height: '100%', padding: '0 14px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${(filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary)' : 'var(--color-border)'}`, background: (filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: (filterSport || filterLanguage || sortBy !== 'score') ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                  <AppIcon name="sliders" size={14} /> {t('canales.filters')}
                </button>
                <AnimatePresence>
                  {showFilters && (
                    <>
                      <div onClick={() => setShowFilters(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                      <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 10, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '16px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('canales.sportFilter')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {['', 'Fútbol', 'Baloncesto', 'Tenis', 'eSports', 'MMA', 'Otros'].map(s => (
                              <button key={s} onClick={() => handleFilterSport(s)}
                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${filterSport === s ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filterSport === s ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: filterSport === s ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: filterSport === s ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {s || t('canales.all')}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('canales.languageFilter')}</div>
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
                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('canales.sortFilter')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {[['score', 'canales.sortRelevance'], ['yield', 'canales.sortYield'], ['members', 'canales.sortMembers'], ['winRate', 'canales.sortAccuracy']].map(([val, labelKey]) => (
                              <button key={val} onClick={() => handleSortBy(val)}
                                style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${sortBy === val ? 'var(--color-primary)' : 'var(--color-border)'}`, background: sortBy === val ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: sortBy === val ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: sortBy === val ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                {t(labelKey)}
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
              <label style={labelStyle}>{t('canales.inviteLabel')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder={t('canales.invitePlaceholder')} value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setInviteError('') }}
                  maxLength={200} style={{ ...inputStyle, width: 'auto', flex: 1 }} />
                <Button size="sm" disabled={!inviteCode.trim() || inviteLoading} onClick={handleJoinByCode}>
                  {inviteLoading ? '...' : t('canales.access')}
                </Button>
              </div>
              {inviteError && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '6px' }}>{inviteError}</div>}
            </div>
            {joinError && (
              <div style={{ background: 'var(--color-error-light)', color: 'var(--color-error)', padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '12px' }}>
                {joinError}
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>{t('canales.searching')}</div>}
            {!searching && (() => {
              const hasActiveFilter = searchQuery.trim() || filterSport || filterLanguage
              const list = hasActiveFilter ? searchResults : suggestedChannels
              if (list.length === 0 && hasActiveFilter) return (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', paddingTop: '8px' }}>{t('canales.noResults')}</div>
              )
              if (list.length === 0) return null
              return (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    {hasActiveFilter ? t('canales.results', { count: list.length }) : t('canales.suggested')}
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
                              <AppIcon name="users" size={12} /><span>{c.memberCount}</span>
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
                              ? <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>{t('canales.alreadyJoined')} <AppIcon name="check" size={11} /></span>
                              : <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700 }}>{t('canales.viewArrow')}</span>}
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
            <div style={{ opacity: 0.25 }}><AppIcon name="canales" size={52} /></div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)', opacity: 0.7 }}>{t('canales.selectTitle')}</div>
            <div style={{ fontSize: '13px', maxWidth: '240px' }}>
              {t(myChannels.length + joinedChannels.length > 0 ? 'canales.selectDescExisting' : 'canales.selectDescNew')}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button variant="ghost" size="sm" onClick={handleOpenSearch}><AppIcon name="search" size={14} /> {t('canales.searchBtn')}</Button>
              {canCreateMore && <Button size="sm" onClick={() => { setShowCreate(true); setShowSearch(false) }}>{t('canales.createBtn')}</Button>}
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
          { labelKey: 'canales.myChannels', channels: ownedSorted },
          { labelKey: 'canales.unitedChannels', channels: joinedSorted },
        ].map(({ labelKey, channels }) => channels.length === 0 ? null : (
          <div key={labelKey}>
            <div className="canales-mini-section">{t(labelKey)}</div>
            {channels.map(ch => {
              const unread = unreadChannelCounts?.get?.(ch.id) || 0
              const isActive = ch.id === focusedId
              const lastMsg = lastMessages[ch.id] || null
              const preview = lastMsg ? formatMsgPreview(lastMsg.content) : (ch.description || '')
              const timeStr = miniTimeAgo(lastMsg?.created_at || ch.created_at, t)
              const chMuteKey = `channel_${ch.id}`
              const chMuted = isMuted(chMuteKey)
              const chPinned = isPinned(ch.id)
              const menuOpen = miniMenuId === ch.id
              const muteOpen = miniMuteId === ch.id
              const miniMenuBtnStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)', gap: '6px' }
              return (
                <div key={ch.id} className={`canales-mini-item${isActive ? ' active' : ''}`}>
                  <div onClick={() => handleOpenChannel(ch)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
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
                          {chPinned && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '3px' }}><AppIcon name="pin" size={10} /></span>}
                          {ch.name}
                        </span>
                        <span className="canales-mini-time">{timeStr}</span>
                      </div>
                      <div className="canales-mini-preview">
                        {chMuted && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}><AppIcon name="bellOff" size={12} /></span>}
                        {preview || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('canales.noMessages')}</span>}
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
                              {chPinned ? <><AppIcon name="pin" size={13} /> {t('social.unpin')}</> : <><AppIcon name="pin" size={13} /> {t('social.pin')}</>}
                            </button>
                            <button onClick={() => {
                              if (chMuted) { unmute(chMuteKey); setMiniMenuId(null) }
                              else { setMiniMuteId(ch.id); setMiniMenuId(null) }
                            }} style={{ ...miniMenuBtnStyle, borderBottom: '0.5px solid var(--color-border)' }}>
                              {chMuted ? <><AppIcon name="bell" size={13} /> {t('social.unmuteNotifs')}</> : <><AppIcon name="bellOff" size={13} /> {t('social.muteNotifs')}</>}
                            </button>
                            <button onClick={() => {
                              if (ch._isOwner) {
                                if (window.confirm(t('canales.deleteConfirm', { name: ch.name }))) {
                                  deleteChannel(ch.id)
                                  if (activeChannel?.id === ch.id) setActiveChannel(null)
                                }
                              } else {
                                requestLeave(ch.id, ch.name)
                              }
                              setMiniMenuId(null)
                            }} style={{ ...miniMenuBtnStyle, color: 'var(--color-error)' }}>
                              {ch._isOwner ? <><AppIcon name="delete" size={13} /> {t('canales.deleteChannel')}</> : <><AppIcon name="leave" size={13} /> {t('leaveChannel.confirm')}</>}
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
                                {t(d.labelKey)}
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
            {t('canales.noChannels')}
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