import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import PostModal from '../feed/PostModal'
import FollowListModal from './FollowListModal'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import Username from '../../../components/ui/Username'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { generateUniqueUsername } from '../../../lib/randomUsername'

function Avatar({ url, name, size = 80, fontSize = 32 }) {
  const [imgError, setImgError] = useState(false)
  if (url && !imgError) return (
    <img src={url} alt="avatar" onError={() => setImgError(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-bg)', display: 'block' }} />
  )
  return (
    <div style={{ width: size, height: size, background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 700, color: '#010906', border: '3px solid var(--color-bg)', flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function StatPill({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ textAlign: 'center', padding: '0 20px', borderRight: '0.5px solid var(--color-border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
    </div>
  )
}

export default function ProfileView({ userId, currentUser, onBack, onStartDM, isFollowing, isFollower, onFollow, onUnfollow, onNavigateToChannel, onBlock, onReport, onViewUser }) {
  const { adminMode } = useAdminMode()
  const [profile, setProfile] = useState(null)
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0, yieldVal: 0, avgOdds: '—' })
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [activeTab, setActiveTab] = useState('stats')
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)

  // Bloc
  const [isBlocked, setIsBlocked] = useState(false)
  const [postModalBetId, setPostModalBetId] = useState(null)
  const [picksSubTab, setPicksSubTab] = useState('public')
  const [premiumChannelIds, setPremiumChannelIds] = useState(new Set())

  // Follow list modal
  const [followListType, setFollowListType] = useState(null) // 'followers' | 'following' | null

  // Mute
  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const muteKey = `user_${userId}`
  const muted = isMuted(muteKey)

  // Admin actions
  const [showAdminWarning, setShowAdminWarning] = useState(false)
  const [adminWarningText, setAdminWarningText] = useState('')
  const [showAdminBan, setShowAdminBan] = useState(false)
  const [adminBanReason, setAdminBanReason] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  // Modal de reset de username
  const [showResetUsername, setShowResetUsername] = useState(false)
  const [banOldName, setBanOldName] = useState(false)

  // Admin: reseteja el nom d'usuari a un random + permet a l'usuari canviar-lo 1 cop sense cooldown
  const handleResetUsername = async () => {
    if (!profile?.username) return
    setAdminBusy(true)
    try {
      const oldUsername = profile.username
      const newUsername = await generateUniqueUsername()
      // Missatge "oficial" — apareix al modal one-time al pròxim login (camp admin_warning)
      const noticeText = `Tu nombre de usuario anterior ha sido cambiado a @${newUsername} por el equipo de FYB porque no cumplía con las normas de la comunidad. Puedes elegir un nuevo nombre de inmediato desde tu perfil, sin esperar el período habitual de 7 días.`
      const { error } = await supabase.from('profiles').update({
        username: newUsername,
        username_reset_pending: true,
        username_changed_at: new Date().toISOString(),
        admin_warning: noticeText,
        warning_notified: false,
      }).eq('id', userId)
      if (error) { alert('Error: ' + error.message); return }

      if (banOldName) {
        // Bany permanent del nom — ningú podrà tornar-lo a fer servir
        supabase.from('banned_usernames').upsert({
          username: oldUsername.toLowerCase(),
          reason: 'Reset admin sobre @' + oldUsername,
        }).then().catch(() => {})
      } else {
        // Reserva temporal (7 dies) per evitar que un altre l'agafi tot d'una
        supabase.from('username_reservations').insert({
          user_id: userId,
          username: oldUsername,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).then().catch(() => {})
      }

      setProfile(prev => prev ? { ...prev, username: newUsername, username_reset_pending: true } : prev)
      setShowResetUsername(false)
      setBanOldName(false)
      alert(`Nombre cambiado a @${newUsername}.${banOldName ? `\n\nEl nombre @${oldUsername} ha sido baneado.` : ''}\n\nEl usuario recibirá una notificación al conectarse.`)
    } finally {
      setAdminBusy(false)
    }
  }

  const handleSendWarning = async () => {
    if (!adminWarningText.trim()) { alert('Escribe el aviso'); return }
    setAdminBusy(true)
    const { error } = await supabase.from('profiles').update({
      admin_warning: adminWarningText.trim(),
      warning_notified: false,
    }).eq('id', userId)
    setAdminBusy(false)
    if (error) { alert('Error: ' + error.message); return }
    setShowAdminWarning(false)
    setAdminWarningText('')
    alert('Aviso enviado. El usuario lo verá la próxima vez que se conecte.')
  }

  const handleBanUser = async () => {
    if (!adminBanReason.trim()) { alert('Escribe el motivo del baneo'); return }
    if (!confirm(`¿Confirmar baneo de @${profile?.username}? Esta acción bloquea su cuenta y email.`)) return
    setAdminBusy(true)
    const email = profile?.email || profile?.username  // si no tenim email al profile, intentem amb el username
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('profiles').update({
        banned: true,
        banned_reason: adminBanReason.trim(),
      }).eq('id', userId),
      profile?.email
        ? supabase.from('banned_emails').upsert({ email: profile.email.toLowerCase(), reason: adminBanReason.trim() })
        : Promise.resolve({ error: null }),
    ])
    setAdminBusy(false)
    if (e1 || e2) { alert('Error: ' + (e1?.message || e2?.message)); return }
    setShowAdminBan(false)
    setAdminBanReason('')
    alert(`Usuario @${profile?.username} baneado.`)
  }
  const [showMuteMenu, setShowMuteMenu] = useState(false)

  // 3-dot menu
  const [showMenu, setShowMenu] = useState(false)
  const [isBlockedByThem, setIsBlockedByThem] = useState(false)

  // Enviar perfil modal
  const [showSendProfile, setShowSendProfile] = useState(false)
  const [sendTab, setSendTab] = useState('dm')
  const [sendConvs, setSendConvs] = useState([])
  const [sendChannels, setSendChannels] = useState([])
  const [loadingSend, setLoadingSend] = useState(false)
  const [sentSet, setSentSet] = useState(new Set())

  useEffect(() => {
    if (!userId) return
    fetchProfile()
  }, [userId])

  const fetchProfile = async () => {
    setLoading(true)
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      const [{ data: prof }, { data: resolvedBets }, { count: fersCount }, { count: fingCount }, { data: blockRow }, { data: activeOffers }, { data: blockByThemRow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('bets').select('*, channel:channels(id, name, is_private, deleted_at)').eq('user_id', userId).neq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        currentUser?.id ? supabase.from('blocks').select('id').eq('blocker_id', currentUser.id).eq('blocked_id', userId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('offers').select('channel_id').eq('active', true),
        currentUser?.id ? supabase.from('blocks').select('id').eq('blocker_id', userId).eq('blocked_id', currentUser.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setPremiumChannelIds(new Set((activeOffers || []).map(o => o.channel_id)))
      setProfile(prof)
      setIsBlocked(!!blockRow)
      setIsBlockedByThem(!!blockByThemRow)
      setFollowersCount(fersCount || 0)
      setFollowingCount(fingCount || 0)

      if (resolvedBets && resolvedBets.length > 0) {
        // Per stats: només won/lost. 'void' (nul, diners retornats) està exclòs.
        const countedBets = resolvedBets.filter(b => b.status === 'won' || b.status === 'lost')
        const won = countedBets.filter(b => b.status === 'won').length
        const lost = countedBets.filter(b => b.status === 'lost').length
        const { profit, stakeSum } = countedBets.reduce(
          (acc, b) => ({
            stakeSum: acc.stakeSum + b.stake,
            profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
          }),
          { profit: 0, stakeSum: 0 }
        )
        const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
        const avgOdds = countedBets.length > 0
          ? (countedBets.reduce((s, b) => s + b.odds, 0) / countedBets.length).toFixed(2)
          : '—'
        // total mostra només els que han comptat, així no es contradiu amb won + lost
        setStats({ total: countedBets.length, won, lost, yieldVal, avgOdds })
        // Pero el historial visible inclou tot (incloent els nuls en blau)
        setBets(resolvedBets)
      }
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const fetchChannels = async () => {
    if (loadingChannels) return
    setLoadingChannels(true)
    try {
      // En mode admin, mostra TOTS els canals (privats, VIP, stakazo). En mode normal només públics.
      let q = supabase.from('channels').select('*').eq('owner_id', userId).is('deleted_at', null)
      if (!adminMode) q = q.eq('is_private', false)
      const { data: chans } = await q
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

  const handleToggleVerify = async () => {
    const newVal = !profile.is_verified
    await supabase.from('profiles').update({
      is_verified: newVal,
      // Reset notified flag perquè el modal aparegui de nou si es re-verifica
      verified_notified: newVal ? false : false,
    }).eq('id', userId)
    setProfile(prev => ({ ...prev, is_verified: newVal }))
    setShowMenu(false)
  }

  const handleBlock = async () => {
    await supabase.from('blocks').upsert({ blocker_id: currentUser.id, blocked_id: userId })
    const { data: myChannels } = await supabase.from('channels').select('id').eq('owner_id', currentUser.id)
    if (myChannels?.length) {
      await supabase.from('channel_members').delete()
        .in('channel_id', myChannels.map(c => c.id))
        .eq('user_id', userId)
    }
    setIsBlocked(true)
    setShowMenu(false)
    onBlock?.(userId)
  }

  const handleUnblock = async () => {
    await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', userId)
    setIsBlocked(false)
  }

  const openSendProfile = async () => {
    setShowSendProfile(true)
    setSentSet(new Set())
    setLoadingSend(true)
    try {
      const [{ data: convData }, { data: myChans }, { data: adminMems }] = await Promise.all([
        supabase.from('dm_conversations')
          .select('id, user1_id, user2_id')
          .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
          .limit(40),
        supabase.from('channels').select('id, name, avatar_url').eq('owner_id', currentUser.id).limit(20),
        supabase.from('channel_members').select('channel_id').eq('user_id', currentUser.id).eq('role', 'admin').limit(20),
      ])

      // DM conversations amb perfil de l'altre
      if (convData?.length) {
        const otherIds = convData.map(c => c.user1_id === currentUser.id ? c.user2_id : c.user1_id)
        const { data: profiles } = await supabase.from('profiles').select('id, username, name, avatar_url, is_verified').in('id', otherIds)
        const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setSendConvs(convData.map(c => {
          const otherId = c.user1_id === currentUser.id ? c.user2_id : c.user1_id
          const p = profMap[otherId] || {}
          return { id: c.id, otherId, username: p.username || '?', name: p.name || '', avatarUrl: p.avatar_url || null, isVerified: p.is_verified || false }
        }))
      } else {
        setSendConvs([])
      }

      // Canals (owner + admin)
      const adminIds = (adminMems || []).map(m => m.channel_id)
      let allChans = [...(myChans || [])]
      if (adminIds.length) {
        const { data: adminChanData } = await supabase.from('channels').select('id, name, avatar_url').in('id', adminIds)
        allChans = [...allChans, ...(adminChanData || [])]
      }
      const seen = new Set()
      setSendChannels(allChans.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true }))
    } catch {
      setSendConvs([])
      setSendChannels([])
    } finally {
      setLoadingSend(false)
    }
  }

  const handleSendProfileTo = async (type, id, displayName) => {
    const content = `[PROFILE]:${userId}:${profile?.username || '?'}`
    try {
      if (type === 'dm') {
        await supabase.from('direct_messages').insert({ conversation_id: id, sender_id: currentUser.id, content })
      } else {
        await supabase.from('channel_messages').insert({ channel_id: id, user_id: currentUser.id, content, created_at: new Date().toISOString() })
      }
      setSentSet(prev => new Set([...prev, id]))
    } catch {}
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>⏳ Cargando perfil...</div>
  )
  if (!profile || isBlockedByThem) return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ fontWeight: 700, fontSize: '16px' }}>Perfil</div>
      </div>
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>Usuario no encontrado</div>
        <div style={{ fontSize: '13px' }}>Este usuario no está disponible.</div>
      </div>
    </motion.div>
  )

  if (isBlocked) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>Perfil</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', textAlign: 'center' }}>
          <Avatar url={profile.avatar_url || null} name={profile.username} size={72} fontSize={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px' }}>{profile.username}</div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 20px' }}>
            🚫 Usuario bloqueado
          </div>
          <button onClick={handleUnblock}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }}>
            Desbloquear
          </button>
        </div>
      </motion.div>
    )
  }

  const isOwnProfile = userId === currentUser?.id
  const displayName = profile.username
  const username = profile.username
  const avatarUrl = profile.avatar_url || null

  const isMutual = isFollowing && isFollower

  const btnSt = (variant) => ({
    background: variant === 'primary' ? 'var(--color-primary)' : variant === 'mutual' ? 'var(--color-primary-light)' : 'var(--color-bg)',
    color: variant === 'primary' ? '#010906' : variant === 'mutual' ? 'var(--color-primary)' : 'var(--color-text)',
    border: variant === 'primary' ? 'none' : variant === 'mutual' ? '0.5px solid var(--color-primary-border)' : '0.5px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer',
    fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)',
  })

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

      {/* BACK */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ fontWeight: 700, fontSize: '16px' }}>Perfil</div>
      </div>

      {/* HEADER CARD */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '20px' }}>

        {/* BANNER */}
        <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, rgba(0,200,100,0.08) 100%)', borderBottom: '0.5px solid var(--color-border)', position: 'relative' }}>
          {!isOwnProfile && (
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowMenu(v => !v)}
                  style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
                  ···
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                      <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 20, minWidth: '170px', overflow: 'hidden' }}>
                        {[
                          { icon: '📤', label: 'Compartir perfil', action: () => { openSendProfile(); setShowMenu(false) } },
                          { icon: '🚩', label: 'Denunciar', action: () => { onReport?.(userId); setShowMenu(false); alert('Usuario denunciado. Lo revisaremos pronto.') } },
                          { icon: '🚫', label: 'Bloquear', action: handleBlock, danger: true },
                          // Opció exclusiva de l'admin: verificar / desverificar tipsters
                          ...(currentUser?.email === 'fyourbet@gmail.com' ? [
                            { icon: profile.is_verified ? '✕' : '✓', label: profile.is_verified ? 'Desverificar' : 'Verificar', action: handleToggleVerify, admin: true },
                          ] : []),
                        ].map((item, i, arr) => (
                          <button key={i} onClick={item.action}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', color: item.danger ? 'var(--color-error)' : item.admin ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: (item.danger || item.admin) ? 700 : 400, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                            <span>{item.icon}</span><span>{item.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* AVATAR + NOM */}
        <div style={{ padding: '0 28px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ marginTop: '-40px' }}>
              <Avatar url={avatarUrl} name={displayName} size={80} fontSize={32} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isFollower && !isOwnProfile && !isMutual && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-border)' }}>
                  Te sigue
                </span>
              )}
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: profile.bio ? '8px' : '16px' }}>
            <Username username={username} isVerified={profile.is_verified} size="xl" />
          </div>
          {profile.bio && (
            <div style={{ fontSize: '14px', color: 'var(--color-text-soft)', marginBottom: '16px', lineHeight: 1.5 }}>{profile.bio}</div>
          )}

          <div style={{ display: 'flex', gap: '0' }}>
            <StatPill label="Seguidores" value={followersCount} onClick={() => setFollowListType('followers')} />
            <StatPill label="Siguiendo" value={followingCount} onClick={() => setFollowListType('following')} />
            <StatPill label="Picks" value={stats.total} />
            {stats.total > 0 && (
              <div style={{ textAlign: 'center', padding: '0 20px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                  {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Yield</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTONS D'ACCIÓ */}
      {!isOwnProfile && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => (isMutual || isFollowing) ? onUnfollow(userId) : onFollow(userId)}
            style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--radius-lg)', border: (isMutual || isFollowing) ? '0.5px solid var(--color-border)' : 'none', background: isMutual ? 'var(--color-primary-light)' : isFollowing ? 'var(--color-bg)' : 'var(--color-primary)', color: isMutual ? 'var(--color-primary)' : isFollowing ? 'var(--color-text-muted)' : '#010906', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            {isMutual ? '👥 Amigos' : isFollowing ? 'Siguiendo ✓' : isFollower ? 'Seguir también' : '+ Seguir'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => onStartDM?.(userId)}
            style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            💬 Mensaje
          </motion.button>
          {/* Campaneta */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMuteMenu(v => !v)}
              style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {muted ? '🔕' : '🔔'}
            </button>
            <AnimatePresence>
              {showMuteMenu && (
                <>
                  <div onClick={() => setShowMuteMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 20, minWidth: '170px', overflow: 'hidden' }}>
                    {muted && (
                      <button onClick={() => { unmute(muteKey); setShowMuteMenu(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                        🔔 Activar notificaciones
                      </button>
                    )}
                    {MUTE_DURATIONS.map((d, i) => (
                      <button key={i} onClick={() => { mute(muteKey, d.ms); setShowMuteMenu(false) }}
                        style={{ display: 'flex', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                        {d.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Accions admin (només visibles en mode admin i en perfils que no siguin el propi) */}
      {adminMode && !isOwnProfile && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-error)', alignSelf: 'center', marginRight: 'auto' }}>🛡️ MODO ADMIN</span>
          <button onClick={() => { setBanOldName(false); setShowResetUsername(true) }} disabled={adminBusy}
            title="Cambiar a nombre aleatorio"
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: adminBusy ? 0.5 : 1 }}>
            🎲 Resetear nombre
          </button>
          <button onClick={() => setShowAdminWarning(true)}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-warning)', background: 'transparent', color: 'var(--color-warning)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            ⚠️ Enviar aviso
          </button>
          {!profile?.banned && (
            <button onClick={() => setShowAdminBan(true)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              🚫 Banear usuario
            </button>
          )}
          {profile?.banned && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-error)', alignSelf: 'center' }}>BANEADO</span>
          )}
        </div>
      )}

      {/* Modal: enviar avís */}
      <AnimatePresence>
        {showAdminWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAdminWarning(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-warning)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-warning)' }}>⚠️ Enviar aviso a @{profile?.username}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                El usuario verá este aviso como modal la próxima vez que se conecte.
              </div>
              <textarea value={adminWarningText} onChange={e => setAdminWarningText(e.target.value)} rows={5}
                placeholder="Texto del aviso..."
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdminWarning(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSendWarning} disabled={adminBusy || !adminWarningText.trim()}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-warning)', color: '#010906', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: adminBusy || !adminWarningText.trim() ? 0.5 : 1 }}>
                  {adminBusy ? 'Enviando...' : 'Enviar aviso'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: banejar */}
      <AnimatePresence>
        {showAdminBan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAdminBan(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-error)' }}>🚫 Banear a @{profile?.username}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                Bloqueja el seu compte i email. No podrà entrar ni re-registrar-se.
              </div>
              <textarea value={adminBanReason} onChange={e => setAdminBanReason(e.target.value)} rows={4}
                placeholder="Motivo del baneo..."
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdminBan(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleBanUser} disabled={adminBusy || !adminBanReason.trim()}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: adminBusy || !adminBanReason.trim() ? 0.5 : 1 }}>
                  {adminBusy ? 'Baneando...' : 'Banear usuario'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: resetejar nom d'usuari amb opció de banejar el nom antic */}
      <AnimatePresence>
        {showResetUsername && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowResetUsername(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>🎲 Resetear nombre de @{profile?.username}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Se generará un nombre aleatorio. El usuario verá un aviso al conectarse y podrá elegir un nuevo nombre sin esperar 7 días.
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '20px' }}>
                <input type="checkbox" checked={banOldName} onChange={e => setBanOldName(e.target.checked)}
                  style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-error)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Banear el nombre @{profile?.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                    Nadie podrá volver a usarlo. Útil si el nombre es ofensivo o suplanta a otra persona.
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowResetUsername(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleResetUsername} disabled={adminBusy}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-text)', color: 'var(--color-bg)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: adminBusy ? 0.5 : 1 }}>
                  {adminBusy ? 'Procesando...' : 'Resetear nombre'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          const publicBets = bets.filter(b => !b.was_private)
          // Premium = privat + canal amb offer activa. Invite-only no apareix al perfil.
          const premiumBets = bets.filter(b => b.was_private && premiumChannelIds.has(b.channel_id))
          const shownBets = picksSubTab === 'public' ? publicBets : premiumBets
          const isOwnProfile = currentUser?.id === userId
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
            {shownBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: 600 }}>
                  {picksSubTab === 'public' ? 'Sin picks públicos todavía' : 'Sin picks premium todavía'}
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {shownBets.map((b, i) => {
                  const isPrivateForViewer = b.was_private && !isOwnProfile
                  return (
                  <div key={b.id} onClick={() => setPostModalBetId(b.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: i < shownBets.length - 1 ? '0.5px solid var(--color-border)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'won' ? 'var(--color-primary)' : b.status === 'void' ? 'var(--color-info)' : 'var(--color-error)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isPrivateForViewer ? 'italic' : 'normal', color: isPrivateForViewer ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                        {isPrivateForViewer ? '🔒 Pick privado' : b.event}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {!isPrivateForViewer && <span>{b.sport} · <strong>{b.pick}</strong> ·</span>}
                        <span>@{parseFloat(b.odds).toFixed(2)} · {b.stake}</span>
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
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                <div>Este tipster aún no tiene picks registrados.</div>
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
                <div style={{ fontWeight: 600 }}>Sin canales públicos</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {channels.map(c => (
                  <div key={c.id} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg-soft)' }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.name[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>#{c.name}</div>
                      {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: '4px' }}>{c.description}</div>}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>👥 {c.memberCount} miembros</span>
                        {stats.total > 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>{stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}% yield tipster</span>}
                        {c.sport && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.sport}</span>}
                        {c.language && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.language}</span>}
                      </div>
                    </div>
                    {onNavigateToChannel ? (
                      <button onClick={() => onNavigateToChannel(c)}
                        style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                        Ver canal
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>🌐 Público</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL ENVIAR PERFIL */}
      <AnimatePresence>
        {showSendProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSendProfile(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', width: '100%', maxWidth: '520px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '0.5px solid var(--color-border)' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>📤 Enviar perfil</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{profile.username}</div>
                </div>
                <button onClick={() => setShowSendProfile(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)' }}>✕</button>
              </div>

              {/* Tabs DM / Canals */}
              <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
                {[['dm', '💬 Mensajes directos'], ['canal', '📡 Canales']].map(([id, label]) => (
                  <button key={id} onClick={() => setSendTab(id)}
                    style={{ flex: 1, padding: '10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: sendTab === id ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: `2px solid ${sendTab === id ? 'var(--color-primary)' : 'transparent'}`, fontFamily: 'var(--font-sans)', transition: 'color 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Llista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {loadingSend ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Cargando...</div>
                ) : sendTab === 'dm' ? (
                  sendConvs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin conversaciones</div>
                  ) : sendConvs.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
                        {c.avatarUrl ? <img src={c.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.username || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>
                          <Username username={c.username} isVerified={c.isVerified} size="sm" />
                        </div>
                      </div>
                      <button onClick={() => handleSendProfileTo('dm', c.id, c.username)} disabled={sentSet.has(c.id)}
                        style={{ background: sentSet.has(c.id) ? 'var(--color-primary-light)' : 'var(--color-primary)', color: sentSet.has(c.id) ? 'var(--color-primary)' : '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: sentSet.has(c.id) ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.2s' }}>
                        {sentSet.has(c.id) ? '✓ Enviado' : 'Enviar'}
                      </button>
                    </div>
                  ))
                ) : (
                  sendChannels.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin canales donde puedes publicar</div>
                  ) : sendChannels.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
                        {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.name || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Canal</div>
                      </div>
                      <button onClick={() => handleSendProfileTo('canal', c.id, c.name)} disabled={sentSet.has(c.id)}
                        style={{ background: sentSet.has(c.id) ? 'var(--color-primary-light)' : 'var(--color-primary)', color: sentSet.has(c.id) ? 'var(--color-primary)' : '#010906', border: 'none', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: sentSet.has(c.id) ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.2s' }}>
                        {sentSet.has(c.id) ? '✓ Enviado' : 'Enviar'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {followListType && (
          <FollowListModal
            type={followListType}
            profileUserId={userId}
            currentUser={currentUser}
            onClose={() => setFollowListType(null)}
            onViewProfile={(uid) => { setFollowListType(null); onViewUser?.(uid) }}
            onStartDM={onStartDM}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {postModalBetId && (
          <PostModal betId={postModalBetId} currentUser={currentUser} onClose={() => setPostModalBetId(null)} />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
