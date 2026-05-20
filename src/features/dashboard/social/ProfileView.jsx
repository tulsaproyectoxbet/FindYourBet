import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import PostModal from '../feed/PostModal'
import FollowListModal from './FollowListModal'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'

function Avatar({ url, name, size = 80, fontSize = 32 }) {
  if (url) return (
    <img src={url} alt="avatar"
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
  const [showMuteMenu, setShowMuteMenu] = useState(false)

  // 3-dot menu
  const [showMenu, setShowMenu] = useState(false)

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
      const [{ data: prof }, { data: resolvedBets }, { count: fersCount }, { count: fingCount }, { data: blockRow }, { data: activeOffers }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('bets').select('*, channel:channels(id, name, is_private, deleted_at)').eq('user_id', userId).neq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        currentUser?.id ? supabase.from('blocks').select('id').eq('blocker_id', currentUser.id).eq('blocked_id', userId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('offers').select('channel_id').eq('active', true),
      ])
      setPremiumChannelIds(new Set((activeOffers || []).map(o => o.channel_id)))
      setProfile(prof)
      setIsBlocked(!!blockRow)
      setFollowersCount(fersCount || 0)
      setFollowingCount(fingCount || 0)

      if (resolvedBets && resolvedBets.length > 0) {
        const won = resolvedBets.filter(b => b.status === 'won').length
        const lost = resolvedBets.filter(b => b.status === 'lost').length
        const { profit, stakeSum } = resolvedBets.reduce(
          (acc, b) => ({
            stakeSum: acc.stakeSum + b.stake,
            profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
          }),
          { profit: 0, stakeSum: 0 }
        )
        const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
        const avgOdds = (resolvedBets.reduce((s, b) => s + b.odds, 0) / resolvedBets.length).toFixed(2)
        setStats({ total: resolvedBets.length, won, lost, yieldVal, avgOdds })
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
    if (loadingChannels || channels.length) return
    setLoadingChannels(true)
    try {
      const { data: chans } = await supabase.from('channels')
        .select('*').eq('owner_id', userId).eq('is_private', false)
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

  const handleBlock = async () => {
    await supabase.from('blocks').upsert({ blocker_id: currentUser.id, blocked_id: userId })
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
        const { data: profiles } = await supabase.from('profiles').select('id, username, name, avatar_url').in('id', otherIds)
        const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setSendConvs(convData.map(c => {
          const otherId = c.user1_id === currentUser.id ? c.user2_id : c.user1_id
          const p = profMap[otherId] || {}
          return { id: c.id, otherId, username: p.username || '?', name: p.name || '', avatarUrl: p.avatar_url || null }
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
  if (!profile) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>Usuario no encontrado</div>
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
            <div style={{ fontWeight: 700, fontSize: '18px' }}>@{profile.username}</div>
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

  const tierLabel = stats.total >= 150 && stats.yieldVal >= 15 ? '💎 Elite'
    : stats.total >= 80 && stats.yieldVal >= 10 ? '🥇 Gold'
    : stats.total >= 30 && stats.yieldVal >= 5 ? '🥈 Silver'
    : stats.total >= 10 ? '🥉 Bronze'
    : null

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
                        ].map((item, i, arr) => (
                          <button key={i} onClick={item.action}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', color: item.danger ? 'var(--color-error)' : 'var(--color-text)', fontWeight: item.danger ? 700 : 400, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
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
              {tierLabel && (
                <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '0.5px solid var(--color-primary-border)', fontWeight: 700 }}>
                  {tierLabel}
                </span>
              )}
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: profile.bio ? '8px' : '16px' }}>@{username}</div>
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
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'won' ? 'var(--color-primary)' : 'var(--color-error)', flexShrink: 0 }} />
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
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600, background: b.status === 'won' ? 'var(--color-primary-light)' : 'var(--color-error-light)', color: b.status === 'won' ? 'var(--color-primary)' : 'var(--color-error)', border: `0.5px solid ${b.status === 'won' ? 'var(--color-primary-border)' : 'var(--color-error-border)'}` }}>
                        {b.status === 'won' ? '✓ Win' : '✗ Loss'}
                      </span>
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
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>@{profile.username}</div>
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
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>@{c.username}</div>
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
