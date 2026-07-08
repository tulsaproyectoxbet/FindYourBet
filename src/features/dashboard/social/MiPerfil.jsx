import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import PostModal from '../feed/PostModal'
import FollowListModal from './FollowListModal'
import { useProfileNav } from '../../../contexts/ProfileNavContext'
import Username from '../../../components/ui/Username'
import SharedAvatar from '../../../components/ui/Avatar'
import { isReservedUsername, isUsernameBanned } from '../../../lib/reservedUsernames'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { clampBio, MAX_BIO_LEN } from '../../../lib/bio'
import { formatMemberSince } from '../../../lib/dates'
import { stripEmojis } from '../../../lib/textLimits'
import ComingSoon from '../../../components/ui/ComingSoon'
import AppIcon from '../../../components/ui/AppIcon'

const DM_OPTIONS = [
  { id: 'followers', iconName: 'lock',  labelKey: 'profile.dmMutual',   descKey: 'profile.dmMutualDesc' },
  { id: 'request',   iconName: 'mail',  labelKey: 'profile.dmRequest',  descKey: 'profile.dmRequestDesc' },
  { id: 'everyone',  iconName: 'globe', labelKey: 'profile.dmEveryone', descKey: 'profile.dmEveryoneDesc' },
]

const inputStyle = {
  width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)',
  color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px',
  padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box'
}

function StatPill({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ textAlign: 'center', padding: '0 20px', borderRight: '0.5px solid var(--color-border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
    </div>
  )
}

function Avatar({ url, name, size = 80, fontSize = 32 }) {
  // Reutilitza el component compartit (gestiona errors d'imatge i reseteja quan canvia el URL)
  return (
    <SharedAvatar url={url} name={name} size={size} fontSize={fontSize}
      borderWidth={3} bg="var(--color-primary)" fg="#010906" />
  )
}

export default function MiPerfil({ user, onNavigate, onAvatarUpdated, onNavigateToChannel }) {
  const { t } = useTranslation()
  const openProfile = useProfileNav()
  const { isAdmin, adminMode, toggleAdminMode } = useAdminMode()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0, yieldVal: 0, avgOdds: '—', profit: 0, avgStake: 0 })
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [recentBets, setRecentBets] = useState([])
  const [dmSetting, setDmSetting] = useState('request')
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [showDmConfig, setShowDmConfig] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingDm, setSavingDm] = useState(false)
  const [activeTab, setActiveTab] = useState('stats')
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [postModalBetId, setPostModalBetId] = useState(null)
  const [picksSubTab, setPicksSubTab] = useState('public')
  const [statsPeriod, setStatsPeriod] = useState('total') // 'total' | '1m' | '3m' | '6m' | '1y' | 'month:YYYY-MM'
  const [statsMonthInput, setStatsMonthInput] = useState('')
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false)
  const [followListType, setFollowListType] = useState(null) // 'followers' | 'following' | null
  const [premiumChannelIds, setPremiumChannelIds] = useState(new Set())
  // Edit form
  const [editForm, setEditForm] = useState({ name: '', username: '', bio: '', card_theme: 0 })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)

  // Depèn de user?.id (estable) en comptes de user (objecte) — evita refetches
  // a cada esdeveniment de Supabase que canvia la referència del user.
  useEffect(() => {
    if (!user?.id) return
    fetchAll()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChannels = async () => {
    if (loadingChannels) return
    setLoadingChannels(true)
    try {
      const { data: chans } = await supabase.from('channels').select('*').eq('owner_id', user.id).is('deleted_at', null)
      if (!chans?.length) { setChannels([]); return }
      const chanIds = chans.map(c => c.id)
      const [{ data: mems }, { data: picks }] = await Promise.all([
        supabase.from('channel_members').select('channel_id').in('channel_id', chanIds),
        supabase.from('channel_messages').select('channel_id').in('channel_id', chanIds).like('content', '[BET]:%'),
      ])
      const countMap = {}
      for (const m of mems || []) countMap[m.channel_id] = (countMap[m.channel_id] || 0) + 1
      const pickMap = {}
      for (const p of picks || []) pickMap[p.channel_id] = (pickMap[p.channel_id] || 0) + 1
      setChannels(chans.map(c => ({ ...c, memberCount: (countMap[c.id] || 0) + 1, pickCount: pickMap[c.id] || 0 })))
    } catch (e) {
      // silent
    } finally {
      setLoadingChannels(false)
    }
  }

  // `silent=true` evita mostrar "Cargando perfil..." en refrescos posteriors (després de guardar)
  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true)
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      // Promise.allSettled: si una query falla, les altres continuen funcionant
      // (abans: Promise.all → si UNA fallava, tot el perfil quedava buit)
      const [profRes, betsRes, fersRes, fingRes, dmRes, offersRes] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('bets').select('*, channel:channels(id, name, is_private, deleted_at)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
        supabase.from('dm_settings').select('allow_dms').eq('user_id', user.id).maybeSingle(),
        supabase.from('offers').select('channel_id').eq('active', true),
      ])

      const prof = profRes.status === 'fulfilled' ? profRes.value.data : null
      const bets = betsRes.status === 'fulfilled' ? betsRes.value.data : null
      const fersCount = fersRes.status === 'fulfilled' ? fersRes.value.count : null
      const fingCount = fingRes.status === 'fulfilled' ? fingRes.value.count : null
      const dmSet = dmRes.status === 'fulfilled' ? dmRes.value.data : null
      const activeOffers = offersRes.status === 'fulfilled' ? offersRes.value.data : null

      // Només actualitza el state si la query ha retornat dades (no esborra valors antics si falla)
      if (prof) setProfile(prof)
      if (fersCount != null) setFollowersCount(fersCount || 0)
      if (fingCount != null) setFollowingCount(fingCount || 0)
      if (activeOffers) setPremiumChannelIds(new Set(activeOffers.map(o => o.channel_id)))
      if (dmSet) setDmSetting(dmSet.allow_dms)
      if (prof) setEditForm({ name: prof.name || '', username: prof.username || '', bio: prof.bio || '', card_theme: prof.card_theme || 0 })

      if (bets && bets.length > 0) {
        // Per stats: només won/lost. 'void' (nul, diners retornats) està exclòs.
        const counted = bets.filter(b => b.status === 'won' || b.status === 'lost')
        const won = counted.filter(b => b.status === 'won').length
        const lost = counted.filter(b => b.status === 'lost').length
        const { profit, stakeSum } = counted.reduce(
          (acc, b) => ({
            stakeSum: acc.stakeSum + b.stake,
            profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
          }),
          { profit: 0, stakeSum: 0 }
        )
        const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
        const avgOdds = counted.length > 0
          ? (counted.reduce((s, b) => s + b.odds, 0) / counted.length).toFixed(2)
          : '—'
        const avgStake = counted.length > 0 ? stakeSum / counted.length : 0
        setStats({ total: counted.length, won, lost, yieldVal, avgOdds, profit, avgStake })
        // Per l'historial visible: won/lost/void (els nuls han d'aparèixer en blau)
        const displayable = bets.filter(b => b.status === 'won' || b.status === 'lost' || b.status === 'void')
        setRecentBets(displayable)
      }
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const handleSaveDm = async (val) => {
    setSavingDm(true)
    setDmSetting(val)
    await supabase.from('dm_settings').upsert({ user_id: user.id, allow_dms: val })
    setSavingDm(false)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) {
      setSaveError(t('profile.avatarFormatError'))
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError(t('profile.avatarSizeError'))
      e.target.value = ''
      return
    }
    setSaveError('')
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveError('')

    if (!editForm.name.trim() || !editForm.username.trim()) {
      setSaveError(t('profile.nameUsernameRequired'))
      setSaving(false)
      return
    }

    const newUsername = editForm.username.trim().toLowerCase()
    const usernameChanged = newUsername !== profile?.username
    let isRevert = false

    // Validació de canvi de username
    if (usernameChanged) {
      // Bloca usernames reservats (marca, rols admin, etc.)
      if (isReservedUsername(newUsername)) {
        setSaveError(t('profile.usernameReserved'))
        setSaving(false)
        return
      }
      // Bloca usernames banejats per l'admin (taula banned_usernames)
      if (await isUsernameBanned(supabase, newUsername)) {
        setSaveError(t('profile.usernameBanned'))
        setSaving(false)
        return
      }

      // Comprova si el nou nom és un que tu mateix vas tenir (bypass del cooldown)
      const { data: ownReservation } = await supabase
        .from('username_reservations')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .ilike('username', newUsername)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      isRevert = !!ownReservation

      // Cooldown 7 dies — només aplica si NO és tornar a un nom previ teu I NO ve d'un reset admin.
      // Quan l'admin reseteja el nom, l'usuari obté un canvi gratuit sense esperar.
      if (!isRevert && !profile?.username_reset_pending && profile?.username_changed_at) {
        const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / 86400000
        if (daysSince < 7) {
          const daysLeft = Math.ceil(7 - daysSince)
          setSaveError(t('profile.usernameCooldown', { days: daysLeft }))
          setSaving(false)
          return
        }
      }

      // Comprova que ningú altre el tingui actualment
      const { data: existing } = await supabase
        .from('profiles').select('id').ilike('username', newUsername).neq('id', user.id).maybeSingle()
      if (existing) {
        setSaveError(t('profile.usernameTaken'))
        setSaving(false)
        return
      }

      // Comprova que cap altre usuari el tingui reservat
      const { data: othersReservation } = await supabase
        .from('username_reservations')
        .select('id')
        .ilike('username', newUsername)
        .neq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (othersReservation) {
        setSaveError(t('profile.usernameOtherReserved'))
        setSaving(false)
        return
      }
    }

    let avatarUrl = profile?.avatar_url || null

    // Puja la foto si n'hi ha una nova
    if (avatarFile) {
  // Esborra totes les fotos antigues d'aquest usuari abans de pujar la nova
  const { data: existingFiles, error: listError } = await supabase.storage
    .from('avatars')
    .list(user.id)

  console.log('existingFiles:', existingFiles, 'listError:', listError)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToDelete)
  }

  const ext = avatarFile.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, avatarFile, { upsert: true })

      if (uploadError) {
        console.log('uploadError:', uploadError)
        setSaveError(t('profile.avatarUploadError'))
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      // Timestamp para forzar reload de la imagen
      avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
    }

    const profileUpdate = {
      name: editForm.name.trim(),
      username: newUsername,
      bio: editForm.bio.trim(),
      avatar_url: avatarUrl,
      card_theme: editForm.card_theme || 0,
    }
    if (usernameChanged) {
      profileUpdate.username_changed_at = new Date().toISOString()
      // Si venia d'un reset admin, ara consum el canvi gratuit — el cooldown torna a aplicar
      if (profile?.username_reset_pending) profileUpdate.username_reset_pending = false
    }

    // UPDATE amb .select() i timeout — si la xarxa penja, no deixem "Guardando..." infinit.
    // El .select() força que retorni les files afectades (verifica que la UPDATE ha tingut efecte).
    let updateResult
    try {
      updateResult = await Promise.race([
        supabase.from('profiles').update(profileUpdate).eq('id', user.id).select().single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
    } catch (e) {
      setSaveError(e.message === 'timeout' ? t('profile.saveTimeout') : t('profile.saveError'))
      setSaving(false)
      return
    }
    if (updateResult.error) {
      setSaveError(t('profile.saveError') + ': ' + updateResult.error.message)
      setSaving(false)
      return
    }
    if (!updateResult.data) {
      setSaveError(t('profile.saveNoPerms'))
      setSaving(false)
      return
    }

    // username_reservations: NO blocking — si falla no afecta l'usuari
    if (usernameChanged) {
      if (profile?.username) {
        supabase.from('username_reservations').insert({
          user_id: user.id,
          username: profile.username,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).then().catch(() => {})
      }
      if (isRevert) {
        supabase.from('username_reservations').delete()
          .eq('user_id', user.id).ilike('username', newUsername)
          .then().catch(() => {})
      }
    }

    // No esperem updateUser ni fetchAll — fer-ho optimisticament tanca el modal a l'instant.
    // L'estat local s'actualitza amb els valors que acabem de desar.
    supabase.auth.updateUser({ data: { name: editForm.name.trim() } }).catch(() => {})

    setProfile(prev => prev ? { ...prev, ...profileUpdate } : prev)
    onAvatarUpdated?.(avatarUrl)
    setShowEditModal(false)
    setAvatarFile(null)
    setAvatarPreview(null)
    setSaving(false)
    // Refresca en segon pla per actualitzar el comptador de seguidors, bets, etc.
    // `silent=true` perquè NO torni a mostrar "Cargando perfil..."
    fetchAll(true).catch(() => {})
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AppIcon name="loading" size={14} /> {t('profile.loadingProfile')}</div>
  )

  const username = profile?.username || 'Usuario'
  const displayName = username
  const avatarUrl = profile?.avatar_url || null

  const currentDmOption = DM_OPTIONS.find(o => o.id === dmSetting)

  return (
    <motion.div key="miperfil" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      {/* HEADER CARD */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '20px' }}>

        {/* BANNER */}
        <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, rgba(0,200,100,0.08) 100%)', borderBottom: '0.5px solid var(--color-border)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowEditModal(true); setShowConfig(false) }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <AppIcon name="edit" size={13} /> {t('profile.editProfile')}
            </button>
            <button onClick={() => { setShowDmConfig(true); setShowConfig(false) }}
              title={t('profile.privacyNotifs')}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              <AppIcon name="bell" size={15} />
            </button>
            <button onClick={() => setShowConfig(!showConfig)}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)' }}>
              ⋯
            </button>
          </div>

          <AnimatePresence>
            {showConfig && (
              <>
                <div onClick={() => setShowConfig(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  style={{ position: 'absolute', top: '44px', right: '12px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '200px', overflow: 'hidden' }}>
                  {[
                    { iconName: 'lock',        labelKey: 'profile.dmPrivacy',   action: () => { setShowDmConfig(true); setShowConfig(false) } },
                    { iconName: 'stats',       labelKey: 'profile.myStats',     action: () => { onNavigate('estadisticas'); setShowConfig(false) } },
                    { iconName: 'historial',   labelKey: 'profile.myHistory',   action: () => { onNavigate('historial'); setShowConfig(false) } },
                    { iconName: 'settings',    labelKey: 'profile.settings',    action: () => { onNavigate('configuracion'); setShowConfig(false) } },
                  ].map((item, i, arr) => (
                    <button key={i} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      <AppIcon name={item.iconName} size={14} /><span>{t(item.labelKey)}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* AVATAR + NOM */}
        <div style={{ padding: '0 28px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ marginTop: '-40px' }}>
              <Avatar url={avatarUrl} name={displayName} size={80} fontSize={32} />
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: '4px' }}>
            <Username username={username} isVerified={profile?.is_verified} size="xl" />
          </div>
          {profile?.created_at && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: profile?.bio ? '8px' : '16px' }}>
              {formatMemberSince(profile.created_at)}
            </div>
          )}
          {profile?.bio && (
            <div style={{ fontSize: '14px', color: 'var(--color-text-soft)', marginBottom: '16px', lineHeight: 1.5 }}>{profile.bio}</div>
          )}

          {/* TOGGLE MODO ADMIN — només visible per a fyourbet@gmail.com */}
          {isAdmin && (
            <button onClick={toggleAdminMode}
              style={{
                width: '100%', marginBottom: '16px', padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: `0.5px solid ${adminMode ? 'var(--color-error-border)' : 'var(--color-border)'}`,
                background: adminMode ? 'var(--color-error-light)' : 'var(--color-bg-soft)',
                color: adminMode ? 'var(--color-error)' : 'var(--color-text-muted)',
                cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
              }}>
              <AppIcon name="shield" size={14} /> {adminMode ? 'MODO ADMIN ACTIVO — Click para salir' : 'Activar modo admin'}
            </button>
          )}

          {/* STATS SOCIALS */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
            <StatPill label={t('profile.followers')} value={followersCount} onClick={() => setFollowListType('followers')} />
            <StatPill label={t('profile.following')} value={followingCount} onClick={() => setFollowListType('following')} />
            <StatPill label={t('profile.picks')} value={stats.total} />
            <div style={{ textAlign: 'center', padding: '0 20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Yield</div>
            </div>
          </div>

          {/* DM SETTING BADGE */}
          <div onClick={() => setShowDmConfig(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {currentDmOption?.iconName && <AppIcon name={currentDmOption.iconName} size={12} />}
            <span>{t('profile.messages')}: <strong style={{ color: 'var(--color-text)' }}>{currentDmOption ? t(currentDmOption.labelKey) : ''}</strong></span>
            <AppIcon name="edit" size={10} />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '0.5px solid var(--color-border)' }}>
        {[
          { id: 'stats',    labelKey: 'profile.tabStats' },
          { id: 'picks',    labelKey: 'profile.tabPicks' },
          { id: 'canales',  labelKey: 'profile.tabChannels' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'canales') fetchChannels() }}
            style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 500, color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--color-primary)' : 'transparent'}`, cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'picks' && (() => {
          const publicBets = recentBets.filter(b => !b.was_private)
          // Premium = privat + canal amb offer activa. Invite-only no apareix al perfil.
          const premiumBets = recentBets.filter(b => b.was_private && premiumChannelIds.has(b.channel_id))
          const shownBets = picksSubTab === 'public' ? publicBets : premiumBets
          return (
          <motion.div key="picks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', width: 'fit-content' }}>
              {[
                { id: 'public',  labelKey: 'profile.picksPublic',  n: publicBets.length },
                { id: 'private', labelKey: 'profile.picksPremium', n: premiumBets.length },
              ].map(ptab => (
                <button key={ptab.id} onClick={() => setPicksSubTab(ptab.id)}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', background: picksSubTab === ptab.id ? 'var(--color-primary)' : 'transparent', color: picksSubTab === ptab.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
                  {t(ptab.labelKey, { n: ptab.n })}
                </button>
              ))}
            </div>
            {recentBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '12px' }}><AppIcon name="document" size={40} /></div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{t('profile.noPicks')}</div>
                <div style={{ fontSize: '13px' }}>{t('profile.noPicksDesc')}</div>
                <button onClick={() => onNavigate('historial')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                  {t('profile.newPick')}
                </button>
              </div>
            ) : shownBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '8px' }}><AppIcon name="document" size={32} /></div>
                <div>{picksSubTab === 'public' ? t('profile.noPicksPublic') : t('profile.noPicksPremium')}</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {shownBets.map(b => {
                  const isWon  = b.status === 'won'
                  const isVoid = b.status === 'void'
                  const statusColor  = isWon ? 'var(--color-primary)' : isVoid ? 'var(--color-info)' : 'var(--color-error)'
                  const statusBg     = isWon ? 'var(--color-primary-light)' : isVoid ? 'var(--color-info-light)' : 'var(--color-error-light)'
                  const statusBorder = isWon ? 'var(--color-primary-border)' : isVoid ? 'var(--color-info-border)' : 'var(--color-error-border)'
                  const label = isWon
                    ? <><AppIcon name="check" size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Win</>
                    : isVoid ? `● ${t('historial.status.void')}`
                    : <><AppIcon name="close" size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Loss</>
                  return (
                    <div key={b.id} onClick={() => setPostModalBetId(b.id)}
                      style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderTop: `3px solid ${statusColor}`, borderRadius: 'var(--radius-lg)', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'box-shadow 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>

                      {/* Sport + resultat */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', padding: '2px 8px', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}>
                          {b.sport}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: 'var(--radius-full)', background: statusBg, color: statusColor, border: `0.5px solid ${statusBorder}`, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                          {label}
                        </span>
                      </div>

                      {/* Event */}
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {b.event}
                      </div>

                      {/* Pick · quota · stake */}
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{b.pick}</span>
                        {' · '}@{parseFloat(b.odds).toFixed(2)}
                        {' · '}{b.stake}u
                      </div>

                      {/* Footer: canal + data */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '0.5px solid var(--color-border)', marginTop: 'auto', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: b.channel && !b.channel.deleted_at ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: b.channel && !b.channel.deleted_at ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontStyle: b.channel?.deleted_at ? 'italic' : 'normal' }}>
                          {b.channel ? (b.channel.deleted_at ? t('profile.channelDeleted') : b.channel.name) : ''}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {new Date(b.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
          )
        })()}

        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {stats.total === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '8px' }}><AppIcon name="barChart" size={32} /></div>
                <div>{t('profile.noPicksRegistered')}</div>
              </div>
            ) : (() => {
              // Filtratge de període sobre totes les apostes carregades
              const now = new Date()
              const cutoff = (() => {
                if (statsPeriod === '1m') return new Date(now.getFullYear(), now.getMonth(), 1)
                if (statsPeriod === '3m') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
                if (statsPeriod === '6m') return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
                if (statsPeriod === '1y') return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
                if (statsPeriod.startsWith('month:')) {
                  const [y, m] = statsPeriod.replace('month:', '').split('-').map(Number)
                  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) }
                }
                return null
              })()
              const allResolved = recentBets.filter(b => b.status === 'won' || b.status === 'lost')
              const filtered = cutoff === null ? allResolved
                : cutoff.start ? allResolved.filter(b => { const d = new Date(b.date); return d >= cutoff.start && d <= cutoff.end })
                : allResolved.filter(b => new Date(b.date) >= cutoff)

              // Calcula stats del període filtrat
              const pWon = filtered.filter(b => b.status === 'won').length
              const pLost = filtered.filter(b => b.status === 'lost').length
              const pTotal = filtered.length
              const { profit: pProfit, stakeSum: pStakeSum } = filtered.reduce(
                (acc, b) => ({ stakeSum: acc.stakeSum + b.stake, profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake) }),
                { profit: 0, stakeSum: 0 }
              )
              const pYield = pStakeSum > 0 ? (pProfit / pStakeSum) * 100 : 0
              const pAvgOdds = pTotal > 0 ? (filtered.reduce((s, b) => s + b.odds, 0) / pTotal).toFixed(2) : '—'
              const pAvgStake = pTotal > 0 ? pStakeSum / pTotal : 0

              const BANK = 1000
              const UNIT = BANK / 100
              const winRate = pTotal > 0 ? (pWon / pTotal) * 100 : 0
              // sense dades al període → colors neutres per evitar fals vermell
              const winRateColor = pTotal === 0 ? 'var(--color-text-muted)' : winRate >= 55 ? 'var(--color-primary)' : winRate >= 45 ? 'var(--color-warning)' : 'var(--color-error)'
              const benefitEur = pProfit * UNIT
              const benefitColor = pTotal === 0 ? 'var(--color-text-muted)' : benefitEur >= 0 ? 'var(--color-primary)' : 'var(--color-error)'
              const yieldColor = pTotal === 0 ? 'var(--color-text-muted)' : pYield >= 0 ? 'var(--color-primary)' : 'var(--color-error)'
              const cardStyle = { background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '28px 16px', textAlign: 'center' }
              const labelStyle = { fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }
              const valStyle = (color) => ({ fontSize: '34px', fontWeight: 700, color, lineHeight: 1 })
              const subStyle = { fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }

              // Etiqueta del mes — construïda manualment per garantir locale correcte
              const monthLabel = statsPeriod.startsWith('month:') ? (() => {
                const [y, m] = statsPeriod.replace('month:', '').split('-').map(Number)
                const name = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long' })
                return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y
              })() : null

              const PERIOD_OPTS = [
                { id: 'total', label: t('profile.periodTotal') },
                { id: '1m',    label: t('profile.periodThisMonth') },
                { id: '3m',    label: t('profile.period3Months') },
                { id: '6m',    label: t('profile.period6Months') },
                { id: '1y',    label: t('profile.period1Year') },
              ]

              return (
                <>
                  {/* Selector de període — dropdown custom amb picker integrat */}
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: '14px' }}>
                    {showPeriodDropdown && (
                      <div onClick={() => setShowPeriodDropdown(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                    )}
                    <button onClick={() => setShowPeriodDropdown(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '7px 12px', cursor: 'pointer', outline: 'none' }}>
                      <span>{statsPeriod.startsWith('month:') ? monthLabel : PERIOD_OPTS.find(p => p.id === statsPeriod)?.label}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '2px' }}>▾</span>
                    </button>
                    {showPeriodDropdown && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 11, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', minWidth: '180px', overflow: 'hidden' }}>
                        {PERIOD_OPTS.map(p => (
                          <button key={p.id} onClick={() => { setStatsPeriod(p.id); setStatsMonthInput(''); setShowPeriodDropdown(false) }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: statsPeriod === p.id ? 'var(--color-primary-light)' : 'transparent', color: statsPeriod === p.id ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: statsPeriod === p.id ? 600 : 400, border: 'none', cursor: 'pointer' }}>
                            {p.label}
                          </button>
                        ))}
                        {/* Separador + picker de mes integrat */}
                        <div style={{ borderTop: '0.5px solid var(--color-border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{t('profile.specificMonth')}</span>
                          <input type="month" value={statsMonthInput}
                            min="2026-01"
                            max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { setStatsMonthInput(e.target.value); if (e.target.value) { setStatsPeriod(`month:${e.target.value}`); setShowPeriodDropdown(false) } }}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '12px', cursor: 'pointer', minWidth: 0 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {true && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>

                      {/* 1 — Win Rate */}
                      <div style={cardStyle}>
                        <div style={labelStyle}>Win Rate</div>
                        <div style={valStyle(winRateColor)}>{winRate.toFixed(0)}%</div>
                        <div style={{ fontSize: '12px', marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{pWon}W</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                          <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>{pLost}L</span>
                        </div>
                      </div>

                      {/* 2 — Cuota media */}
                      <div style={cardStyle}>
                        <div style={labelStyle}>{t('profile.avgOdds')}</div>
                        <div style={valStyle('var(--color-warning)')}>{pAvgOdds}</div>
                        <div style={subStyle}>{t('profile.avgOddsDesc')}</div>
                      </div>

                      {/* 3 — Yield */}
                      <div style={cardStyle}>
                        <div style={labelStyle}>Yield</div>
                        <div style={valStyle(yieldColor)}>{pYield >= 0 ? '+' : ''}{pYield.toFixed(2)}%</div>
                        <div style={subStyle}>{t('profile.yieldDesc')}</div>
                      </div>

                      {/* 4 — Stake medio */}
                      <div style={cardStyle}>
                        <div style={labelStyle}>{t('profile.avgStake')}</div>
                        <div style={valStyle('var(--color-text)')}>{pAvgStake.toFixed(1)}</div>
                        <div style={subStyle}>{t('profile.avgStakeDesc')}</div>
                      </div>

                      {/* 5 — Beneficio (banco 1.000€, 1u = 1% = 10€) — ocupa tota la fila */}
                      <div style={{ ...cardStyle, border: `0.5px solid ${benefitEur >= 0 ? 'var(--color-primary-border)' : 'var(--color-error-border)'}`, gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>{t('profile.benefit')}</div>
                        <div style={valStyle(benefitColor)}>{benefitEur >= 0 ? '+' : ''}{benefitEur.toFixed(0)}€</div>
                        <div style={subStyle}>{t('profile.bankDesc')}</div>
                      </div>

                    </div>
                  )}
                </>
              )
            })()}
          </motion.div>
        )}

        {activeTab === 'canales' && (
          <motion.div key="canales" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loadingChannels ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AppIcon name="loading" size={14} /> {t('profile.loadingChannels')}</div>
            ) : channels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '12px' }}><AppIcon name="canales" size={40} /></div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{t('profile.noChannels')}</div>
                <button onClick={() => onNavigate('canales')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                  {t('profile.createChannel')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {channels.map(c => {
                  const yieldColor = stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)'
                  const statCol = (value, label, color) => (
                    <div style={{ textAlign: 'center', padding: '0 14px', borderLeft: '0.5px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: color || 'var(--color-text)', lineHeight: 1.2 }}>{value}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                    </div>
                  )
                  return (
                    <div key={c.id} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Avatar */}
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg-soft)' }}>
                        {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.name[0].toUpperCase()}
                      </div>
                      {/* Nom + stats en la mateixa fila + descripció */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</span>
                          {c.is_private && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AppIcon name="lock" size={10} /> {t('profile.private')}</span>}
                          {c.sport && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>{c.sport}</span>}
                          {/* Stats inline al costat del nom */}
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {statCol(c.memberCount, t('channels.members'))}
                            {statCol(c.pickCount, t('profile.picks'))}
                            {stats.total > 0 && statCol(`${stats.yieldVal >= 0 ? '+' : ''}${stats.yieldVal.toFixed(1)}%`, 'Yield', yieldColor)}
                          </div>
                        </div>
                        {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.description}</div>}
                      </div>
                      {onNavigateToChannel && (
                        <button onClick={() => onNavigateToChannel(c)}
                          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0, marginLeft: '8px' }}>
                          {t('profile.goToChannel')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* MODAL EDITAR PERFIL */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setShowEditModal(false)}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><AppIcon name="edit" size={16} /> {t('profile.editProfile')}</div>
                <button onClick={() => setShowEditModal(false)}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>

              {/* FOTO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '20px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar url={avatarPreview || avatarUrl} name={displayName} size={72} fontSize={28} />
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="camera" size={12} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{t('profile.profilePhoto')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{t('profile.photoDesc')}</div>
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    {t('profile.changePhoto')}
                  </button>
                </div>
              </div>

              {/* CAMPS */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{t('profile.fullName')}</label>
                <input style={inputStyle} placeholder={t('profile.namePlaceholder')} value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: stripEmojis(e.target.value) }))} maxLength={50} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Username *</label>
                <input style={inputStyle} placeholder="username" value={editForm.username}
                  onChange={e => setEditForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} maxLength={20} />
                {(() => {
                  if (!profile?.username_changed_at) return null
                  const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / 86400000
                  if (daysSince >= 7) return <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AppIcon name="check" size={11} /> {t('profile.usernameCanChange')}</div>
                  const daysLeft = Math.ceil(7 - daysSince)
                  return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AppIcon name="lock" size={11} /> {t('profile.usernameChangeable', { days: daysLeft })}</div>
                })()}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Bio</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                  placeholder={t('profile.bioPlaceholder')}
                  value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: clampBio(e.target.value) }))}
                  maxLength={MAX_BIO_LEN} />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{editForm.bio.length}/{MAX_BIO_LEN}</div>
              </div>

              {saveError && (
                <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveProfile} disabled={saving}
                  style={{ flex: 1, background: saving ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: saving ? 'var(--color-text-muted)' : '#010906', border: 'none', padding: '12px', borderRadius: 'var(--radius-md)', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                  {saving ? t('profile.saving') : t('profile.saveChanges')}
                </button>
                <button onClick={() => setShowEditModal(false)}
                  style={{ padding: '12px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
                  {t('social.cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CONFIG DMs */}
      <AnimatePresence>
        {showDmConfig && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setShowDmConfig(false)}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><AppIcon name="lock" size={16} /> {t('profile.dmPrivacy')}</div>
                <button onClick={() => setShowDmConfig(false)}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                {t('profile.dmPrivacyDesc')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DM_OPTIONS.map(opt => (
                  <div key={opt.id} onClick={() => handleSaveDm(opt.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <AppIcon name={opt.iconName} size={22} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-text)' }}>{t(opt.labelKey)}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{t(opt.descKey)}</div>
                    </div>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dmSetting === opt.id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#010906' }} />}
                    </div>
                  </div>
                ))}
              </div>
              {savingDm && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px', textAlign: 'center' }}>{t('profile.saving')}</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {followListType && (
          <FollowListModal
            type={followListType}
            profileUserId={user.id}
            currentUser={user}
            onClose={() => setFollowListType(null)}
            onViewProfile={(uid) => { setFollowListType(null); openProfile(uid) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {postModalBetId && (
          <PostModal betId={postModalBetId} currentUser={user} onClose={() => setPostModalBetId(null)} />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
