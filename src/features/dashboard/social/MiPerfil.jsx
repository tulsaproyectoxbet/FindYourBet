import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import PostModal from '../feed/PostModal'
import FollowListModal from './FollowListModal'
import { useProfileNav } from '../../../contexts/ProfileNavContext'
import Username from '../../../components/ui/Username'
import SharedAvatar from '../../../components/ui/Avatar'
import { isReservedUsername, isUsernameBanned } from '../../../lib/reservedUsernames'
import { useAdminMode } from '../../../contexts/AdminModeContext'

const DM_OPTIONS = [
  { id: 'followers', icon: '🔒', label: 'Solo seguidores mutuos', desc: 'Solo quien te siga y tú le sigas puede escribirte' },
  { id: 'request', icon: '📨', label: 'Un mensaje', desc: 'Cualquiera puede enviarte 1 mensaje. Tú decides si aceptas' },
  { id: 'everyone', icon: '🌐', label: 'Todos', desc: 'Cualquiera puede escribirte sin restricción' },
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
  const openProfile = useProfileNav()
  const { isAdmin, adminMode, toggleAdminMode } = useAdminMode()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0, yieldVal: 0, avgOdds: '—' })
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
  const [followListType, setFollowListType] = useState(null) // 'followers' | 'following' | null
  const [premiumChannelIds, setPremiumChannelIds] = useState(new Set())

  // Edit form
  const [editForm, setEditForm] = useState({ name: '', username: '', bio: '' })
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
      const { data: mems } = await supabase
        .from('channel_members').select('channel_id')
        .in('channel_id', chans.map(c => c.id))
      const countMap = {}
      for (const m of mems || []) countMap[m.channel_id] = (countMap[m.channel_id] || 0) + 1
      setChannels(chans.map(c => ({ ...c, memberCount: (countMap[c.id] || 0) + 1 })))
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
        supabase.from('bets').select('*, channel:channels(id, name, is_private, deleted_at)').eq('user_id', user.id).order('created_at', { ascending: false }),
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
      if (prof) setEditForm({ name: prof.name || '', username: prof.username || '', bio: prof.bio || '' })

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
        setStats({ total: counted.length, won, lost, yieldVal, avgOdds })
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
      setSaveError('Formato no permitido. Solo JPG o PNG.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('La foto pesa más de 5MB.')
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
      setSaveError('El nombre y username son obligatorios')
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
        setSaveError('Este username está reservado y no puede usarse.')
        setSaving(false)
        return
      }
      // Bloca usernames banejats per l'admin (taula banned_usernames)
      if (await isUsernameBanned(supabase, newUsername)) {
        setSaveError('Este username está bloqueado y no puede usarse.')
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
          setSaveError(`Aún no puedes cambiar tu nombre de usuario. Podrás hacerlo en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}.`)
          setSaving(false)
          return
        }
      }

      // Comprova que ningú altre el tingui actualment
      const { data: existing } = await supabase
        .from('profiles').select('id').ilike('username', newUsername).neq('id', user.id).maybeSingle()
      if (existing) {
        setSaveError('Este username ya está en uso')
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
        setSaveError('Este username está reservado por otro usuario. Inténtalo en unos días.')
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
        setSaveError('Error al subir la foto')
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
      setSaveError(e.message === 'timeout' ? 'La conexión ha tardado demasiado. Inténtalo de nuevo.' : 'Error al guardar')
      setSaving(false)
      return
    }
    if (updateResult.error) {
      setSaveError('Error al guardar: ' + updateResult.error.message)
      setSaving(false)
      return
    }
    if (!updateResult.data) {
      setSaveError('No se pudo guardar (sin permisos o sesión caducada).')
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
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-text-muted)' }}>⏳ Cargando perfil...</div>
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
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }}>
              ✏️ Editar perfil
            </button>
            <button onClick={() => { setShowDmConfig(true); setShowConfig(false) }}
              title="Privacidad de notificaciones"
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-muted)' }}>
              🔔
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
                    { icon: '🔐', label: 'Privacidad de mensajes', action: () => { setShowDmConfig(true); setShowConfig(false) } },
                    { icon: '📊', label: 'Mis estadísticas', action: () => { onNavigate('estadisticas'); setShowConfig(false) } },
                    { icon: '📋', label: 'Mi historial', action: () => { onNavigate('historial'); setShowConfig(false) } },
                    { icon: '⚙️', label: 'Configuración', action: () => { onNavigate('configuracion'); setShowConfig(false) } },
                  ].map((item, i, arr) => (
                    <button key={i} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      <span>{item.icon}</span><span>{item.label}</span>
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

          <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: profile?.bio ? '8px' : '16px' }}>
            <Username username={username} isVerified={profile?.is_verified} size="xl" />
          </div>
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
              🛡️ {adminMode ? 'MODO ADMIN ACTIVO — Click para salir' : 'Activar modo admin'}
            </button>
          )}

          {/* STATS SOCIALS */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
            <StatPill label="Seguidores" value={followersCount} onClick={() => setFollowListType('followers')} />
            <StatPill label="Siguiendo" value={followingCount} onClick={() => setFollowListType('following')} />
            <StatPill label="Picks" value={stats.total} />
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
            <span>{currentDmOption?.icon}</span>
            <span>Mensajes: <strong style={{ color: 'var(--color-text)' }}>{currentDmOption?.label}</strong></span>
            <span style={{ fontSize: '10px' }}>✏️</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '0.5px solid var(--color-border)' }}>
        {[
          { id: 'stats', label: '📊 Rendimiento' },
          { id: 'canales', label: '📡 Canales' },
          { id: 'picks', label: '📋 Últimos picks' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id === 'canales') fetchChannels() }}
            style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 500, color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`, cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            {t.label}
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
                { id: 'public',  label: `🌐 Públicos (${publicBets.length})` },
                { id: 'private', label: `💎 Premium (${premiumBets.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setPicksSubTab(t.id)}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', background: picksSubTab === t.id ? 'var(--color-primary)' : 'transparent', color: picksSubTab === t.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {recentBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin picks todavía</div>
                <div style={{ fontSize: '13px' }}>Tus apuestas resueltas aparecerán aquí.</div>
                <button onClick={() => onNavigate('historial')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                  + Nueva apuesta
                </button>
              </div>
            ) : shownBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                <div>{picksSubTab === 'public' ? 'Sin picks públicos' : 'Sin picks premium'}</div>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {shownBets.map((b, i) => (
                  <div key={b.id} onClick={() => setPostModalBetId(b.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: i < shownBets.length - 1 ? '0.5px solid var(--color-border)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'won' ? 'var(--color-primary)' : b.status === 'void' ? 'var(--color-info)' : 'var(--color-error)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.event}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{b.sport} · <strong>{b.pick}</strong> · @{parseFloat(b.odds).toFixed(2)} · {b.stake}</span>
                        {b.channel && (
                          <>
                            <span>·</span>
                            {b.channel.deleted_at
                              ? <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Canal eliminado</span>
                              : <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{b.channel.name}</span>}
                          </>
                        )}
                        <span style={{ padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', fontSize: '9px', fontWeight: 700 }}>
                          {b.was_private ? '💎 Premium' : '🌐 Público'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {(() => {
                        const isWon = b.status === 'won'
                        const isVoid = b.status === 'void'
                        const bg = isWon ? 'var(--color-primary-light)' : isVoid ? 'var(--color-info-light)' : 'var(--color-error-light)'
                        const fg = isWon ? 'var(--color-primary)' : isVoid ? 'var(--color-info)' : 'var(--color-error)'
                        const bd = isWon ? 'var(--color-primary-border)' : isVoid ? 'var(--color-info-border)' : 'var(--color-error-border)'
                        const label = isWon ? '✓ Win' : isVoid ? '● Nula' : '✗ Loss'
                        return (
                          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600, background: bg, color: fg, border: `0.5px solid ${bd}` }}>
                            {label}
                          </span>
                        )
                      })()}
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {new Date(b.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
          )
        })()}

        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {stats.total === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                <div>Aún no tienes picks registrados.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Yield total', value: `${stats.yieldVal >= 0 ? '+' : ''}${stats.yieldVal.toFixed(2)}%`, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)', sub: 'Beneficio sobre apostado' },
                  { label: 'W / L', value: `${stats.won} / ${stats.lost}`, color: 'var(--color-text)', sub: 'Ganadas / Perdidas' },
                  { label: 'Total picks', value: stats.total, color: 'var(--color-text)', sub: 'Picks resueltos' },
                  { label: 'Cuota media', value: stats.avgOdds, color: 'var(--color-warning)', sub: 'Promedio de cuotas' },
                  { label: 'Win rate', value: stats.total > 0 ? `${((stats.won / stats.total) * 100).toFixed(0)}%` : '—', color: 'var(--color-text)', sub: 'Porcentaje de acierto' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{s.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'canales' && (
          <motion.div key="canales" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loadingChannels ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>⏳ Cargando canales...</div>
            ) : channels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📡</div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin canales todavía</div>
                <button onClick={() => onNavigate('canales')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                  + Crear canal
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {channels.map(c => (
                  <div key={c.id} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg-soft)' }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</span>
                        {c.is_private && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>🔒 Privado</span>}
                        {c.sport && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px' }}>{c.sport}</span>}
                      </div>
                      {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: '4px' }}>{c.description}</div>}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>👥 {c.memberCount} miembros</span>
                        {c.language && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.language}</span>}
                      </div>
                    </div>
                    {onNavigateToChannel ? (
                      <button onClick={() => onNavigateToChannel(c)}
                        style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                        Ir al canal
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>Tu canal</span>
                    )}
                  </div>
                ))}
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
                <div style={{ fontWeight: 700, fontSize: '18px' }}>✏️ Editar perfil</div>
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
                    style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    📷
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Foto de perfil</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>JPG o PNG. Máx 5MB.</div>
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    Cambiar foto
                  </button>
                </div>
              </div>

              {/* CAMPS */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Nombre completo *</label>
                <input style={inputStyle} placeholder="Tu nombre" value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Username *</label>
                <input style={inputStyle} placeholder="username" value={editForm.username}
                  onChange={e => setEditForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                {(() => {
                  if (!profile?.username_changed_at) return null
                  const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / 86400000
                  if (daysSince >= 7) return <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px' }}>✓ Puedes cambiar tu username</div>
                  const daysLeft = Math.ceil(7 - daysSince)
                  return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>🔒 Podrás cambiarlo en {daysLeft} día{daysLeft !== 1 ? 's' : ''} (o vuelve a un username anterior tuyo en cualquier momento)</div>
                })()}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Bio</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                  placeholder="Cuéntale a la comunidad quién eres como tipster..."
                  value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  maxLength={160} />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{editForm.bio.length}/160</div>
              </div>

              {saveError && (
                <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveProfile} disabled={saving}
                  style={{ flex: 1, background: saving ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: saving ? 'var(--color-text-muted)' : '#010906', border: 'none', padding: '12px', borderRadius: 'var(--radius-md)', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setShowEditModal(false)}
                  style={{ padding: '12px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
                  Cancelar
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
                <div style={{ fontWeight: 700, fontSize: '18px' }}>🔐 Privacidad de mensajes</div>
                <button onClick={() => setShowDmConfig(false)}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                Controla quién puede enviarte mensajes directos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DM_OPTIONS.map(opt => (
                  <div key={opt.id} onClick={() => handleSaveDm(opt.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '22px' }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-text)' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dmSetting === opt.id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#010906' }} />}
                    </div>
                  </div>
                ))}
              </div>
              {savingDm && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px', textAlign: 'center' }}>Guardando...</div>}
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