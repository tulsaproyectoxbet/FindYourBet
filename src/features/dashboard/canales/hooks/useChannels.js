import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'

const MAX_OWN_CHANNELS = 5
const MAX_JOINED_CHANNELS = 30

// Genera un código de invitación aleatorio de 8 caracteres
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toLowerCase()
}

export function useChannels(user) {
  const [myChannels, setMyChannels] = useState([])
  const [joinedChannels, setJoinedChannels] = useState([])
  const [memberCounts, setMemberCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || user.id === 'dev-skip') { setLoading(false); return }
    fetchChannels()
  }, [user])

  const fetchChannels = async () => {
    setLoading(true)
    // Safety net: si una query es penja, mai deixar la UI atrapada en "Cargando"
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      // Canals propis: el propietari els ha eliminat → els amaguem (ja no els ha de veure)
      const { data: own } = await supabase
        .from('channels').select('*').eq('owner_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setMyChannels(own || [])

      const { data: memberships } = await supabase
        .from('channel_members').select('channel_id, channels(*)')
        .eq('user_id', user.id)

      // Canals on sóc membre: mostro els actius + els eliminats fa <3 dies perquè vegin
      // el banner i puguin sortir. Després de 3 dies desapareixen automàticament del llistat.
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const joined = memberships
        ?.map(m => m.channels)
        .filter(c => c && !(own || []).some(o => o.id === c.id))
        .filter(c => !c.deleted_at || c.deleted_at > threeDaysAgo) || []
      setJoinedChannels(joined)

      const allChannels = [...(own || []), ...joined]
      const counts = {}
      if (allChannels.length) {
        const { data: mems } = await supabase
          .from('channel_members').select('channel_id')
          .in('channel_id', allChannels.map(c => c.id))
        for (const m of mems || []) counts[m.channel_id] = (counts[m.channel_id] || 0) + 1
        for (const c of allChannels) counts[c.id] = (counts[c.id] || 0) + 1
      }
      setMemberCounts(counts)
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const createChannel = async (name, description, isPrivate = false) => {
    const trimmed = name.trim()
    if (!trimmed) return { error: 'El nombre es obligatorio' }
    if (myChannels.length >= MAX_OWN_CHANNELS) return { error: `Límite de ${MAX_OWN_CHANNELS} canales propios alcanzado` }

    // Nom únic per canals públics (case-insensitive). Si està eliminat fa <7 dies
    // i ets el propietari original, pots reutilitzar el nom. Si és un altre owner, bloquejat.
    if (!isPrivate) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: conflicts } = await supabase
        .from('channels')
        .select('id, owner_id, deleted_at')
        .eq('is_private', false)
        .ilike('name', trimmed)
      const blocking = (conflicts || []).find(c => {
        if (!c.deleted_at) return true                          // canal actiu → blocked
        if (c.owner_id === user.id) return false                // l'has eliminat tu → pots tornar a usar-lo
        if (c.deleted_at > sevenDaysAgo) return true            // un altre l'ha eliminat fa <7 dies → blocked
        return false                                            // >7 dies, alliberat
      })
      if (blocking) return { error: 'Ese nombre de canal ya está en uso' }
    }

    const invite_code = generateInviteCode()

    const { data, error } = await supabase
      .from('channels').insert({
        owner_id: user.id,
        name: trimmed,
        description: description.trim(),
        is_private: isPrivate,
        invite_code
      })
      .select().single()

    if (!error) {
      setMyChannels(prev => [data, ...prev])
      setMemberCounts(prev => ({ ...prev, [data.id]: 1 }))
    }
    return { data, error }
  }

  const deleteChannel = async (channelId, reason = null) => {
    // Soft delete: marquem deleted_at + motiu opcional. Missatges i membres queden
    // intactes perquè els picks segueixin accessibles via PostModal i els membres
    // puguin sortir manualment durant 3 dies abans de l'ocultació automàtica.
    await supabase.from('channels').update({
      deleted_at: new Date().toISOString(),
      deletion_reason: reason,
    }).eq('id', channelId)
    setMyChannels(prev => prev.filter(c => c.id !== channelId))
  }

  const searchChannels = async (query, { sport = '', language = '', sortBy = 'score' } = {}) => {
    let q = supabase.from('channels')
      .select('*')
      .eq('is_private', false)
      .is('deleted_at', null)
      .ilike('name', query.trim() ? `%${query}%` : '%')
      .limit(20)

    if (sport)    q = q.eq('sport', sport)
    if (language) q = q.eq('language', language)

    const { data: channels } = await q
    if (!channels?.length) return []

    const channelIds = channels.map(c => c.id)
    const ownerIds = [...new Set(channels.map(c => c.owner_id))]

    const [{ data: rawMems }, { data: profiles }, { data: bets }] = await Promise.all([
      supabase.from('channel_members').select('channel_id').in('channel_id', channelIds),
      supabase.from('profiles').select('id, username, name, avatar_url').in('id', ownerIds),
      supabase.from('bets').select('user_id, status, stake, odds')
        .in('user_id', ownerIds).in('status', ['won', 'lost']).limit(500),
    ])

    const memberMap = {}
    for (const m of rawMems || []) memberMap[m.channel_id] = (memberMap[m.channel_id] || 0) + 1
    for (const id of channelIds) memberMap[id] = (memberMap[id] || 0) + 1 // +1 propietari
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    const statsMap = {}
    for (const uid of ownerIds) {
      const ownerBets = (bets || []).filter(b => b.user_id === uid)
      if (!ownerBets.length) { statsMap[uid] = { yieldVal: 0, winRate: 0, total: 0 }; continue }
      const won = ownerBets.filter(b => b.status === 'won')
      const { profit, stakeSum } = ownerBets.reduce(
        (acc, b) => ({ stakeSum: acc.stakeSum + b.stake, profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake) }),
        { profit: 0, stakeSum: 0 }
      )
      statsMap[uid] = {
        yieldVal: stakeSum > 0 ? (profit / stakeSum) * 100 : 0,
        winRate: (won.length / ownerBets.length) * 100,
        total: ownerBets.length,
      }
    }

    const enriched = channels.map(c => ({
      ...c,
      memberCount: memberMap[c.id] || 1,
      ownerProfile: profileMap[c.owner_id] || null,
      ownerStats: statsMap[c.owner_id] || { yieldVal: 0, winRate: 0, total: 0 },
    }))

    const maxMembers = Math.max(...enriched.map(c => c.memberCount), 1)
    const scoreOf = c => (c.memberCount / maxMembers) * 60 + Math.max(0, c.ownerStats.yieldVal) * 1.5 + c.ownerStats.winRate * 0.4

    return enriched.sort((a, b) => {
      switch (sortBy) {
        case 'yield':   return b.ownerStats.yieldVal - a.ownerStats.yieldVal
        case 'members': return b.memberCount - a.memberCount
        case 'winRate': return b.ownerStats.winRate - a.ownerStats.winRate
        default:        return scoreOf(b) - scoreOf(a)
      }
    })
  }

  // Busca un canal por código de invitación (para canales privados)
  const findChannelByCode = async (code) => {
    if (!code.trim()) return null
    const { data } = await supabase.from('channels').select('*')
      .eq('invite_code', code.trim().toLowerCase())
      .single()
    return data || null
  }

  const joinChannel = async (channelId) => {
    if (joinedChannels.length >= MAX_JOINED_CHANNELS) return { error: `Límite de ${MAX_JOINED_CHANNELS} canales alcanzado` }

    // Comprova si l'usuari té un veto actiu
    const { data: ban } = await supabase.from('channel_bans')
      .select('banned_until').eq('channel_id', channelId).eq('user_id', user.id).maybeSingle()
    if (ban) {
      if (!ban.banned_until) return { error: 'Tienes un veto permanente en este canal' }
      if (new Date(ban.banned_until) > new Date()) {
        const until = new Date(ban.banned_until).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        return { error: `Vetado hasta el ${until}` }
      }
      // Veto caducat — esborra'l
      await supabase.from('channel_bans').delete().eq('channel_id', channelId).eq('user_id', user.id)
    }

    const { data: existing } = await supabase.from('channel_members').select('id')
      .eq('channel_id', channelId).eq('user_id', user.id).maybeSingle()
    if (existing) return { alreadyJoined: true }
    const { error } = await supabase.from('channel_members')
      .insert({ channel_id: channelId, user_id: user.id })
    if (!error) await fetchChannels()
    return { error }
  }

  const leaveChannel = async (channelId) => {
    await supabase.from('channel_members').delete()
      .eq('channel_id', channelId).eq('user_id', user.id)
    await fetchChannels()
  }

  const updateChannel = (updated) => {
    setMyChannels(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
    setJoinedChannels(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  return {
    myChannels, joinedChannels, memberCounts, loading,
    createChannel, deleteChannel, updateChannel, searchChannels, findChannelByCode,
    joinChannel, leaveChannel, refetch: fetchChannels,
    MAX_OWN_CHANNELS, MAX_JOINED_CHANNELS
  }
}