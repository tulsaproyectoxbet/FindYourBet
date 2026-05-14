import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'

const MAX_OWN_CHANNELS = 5
const MAX_JOINED_CHANNELS = 30

// Genera un codi d'invitació aleatori de 8 caràcters
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
    const { data: own } = await supabase
      .from('channels').select('*').eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    setMyChannels(own || [])

    const { data: memberships } = await supabase
      .from('channel_members').select('channel_id, channels(*)')
      .eq('user_id', user.id)

    const joined = memberships
      ?.map(m => m.channels)
      .filter(c => c && !(own || []).some(o => o.id === c.id)) || []
    setJoinedChannels(joined)

    const allChannels = [...(own || []), ...joined]
    const counts = {}
    await Promise.all(allChannels.map(async c => {
      const { count } = await supabase
        .from('channel_members').select('*', { count: 'exact', head: true })
        .eq('channel_id', c.id)
      counts[c.id] = (count || 0) + 1
    }))
    setMemberCounts(counts)
    setLoading(false)
  }

  const createChannel = async (name, description, isPrivate = false) => {
    if (!name.trim()) return { error: 'El nombre es obligatorio' }
    if (myChannels.length >= MAX_OWN_CHANNELS) return { error: `Límite de ${MAX_OWN_CHANNELS} canales propios alcanzado` }

    const invite_code = generateInviteCode()

    const { data, error } = await supabase
      .from('channels').insert({
        owner_id: user.id,
        name: name.trim(),
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

  const deleteChannel = async (channelId) => {
    await supabase.from('channel_messages').delete().eq('channel_id', channelId)
    await supabase.from('channel_members').delete().eq('channel_id', channelId)
    await supabase.from('channels').delete().eq('id', channelId)
    setMyChannels(prev => prev.filter(c => c.id !== channelId))
  }

  const searchChannels = async (query) => {
    const { data: channels } = await supabase.from('channels')
      .select('*')
      .eq('is_private', false)
      .ilike('name', query.trim() ? `%${query}%` : '%')
      .limit(query.trim() ? 15 : 12)

    if (!channels?.length) return []

    const channelIds = channels.map(c => c.id)
    const ownerIds = [...new Set(channels.map(c => c.owner_id))]

    const [memberResults, { data: profiles }, { data: bets }] = await Promise.all([
      Promise.all(channelIds.map(id =>
        supabase.from('channel_members')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', id)
          .then(({ count }) => ({ id, count: (count || 0) + 1 }))
      )),
      supabase.from('profiles').select('id, username, name, avatar_url').in('id', ownerIds),
      supabase.from('bets').select('user_id, status, stake, odds')
        .in('user_id', ownerIds)
        .in('status', ['won', 'lost']),
    ])

    const memberMap = Object.fromEntries(memberResults.map(m => [m.id, m.count]))
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
    return enriched.sort((a, b) => {
      const score = c => (c.memberCount / maxMembers) * 60 + Math.max(0, c.ownerStats.yieldVal) * 1.5 + c.ownerStats.winRate * 0.4
      return score(b) - score(a)
    })
  }

  // Busca un canal pel codi d'invitació (per canals privats)
  const findChannelByCode = async (code) => {
    if (!code.trim()) return null
    const { data } = await supabase.from('channels').select('*')
      .eq('invite_code', code.trim().toLowerCase())
      .single()
    return data || null
  }

  const joinChannel = async (channelId) => {
    if (joinedChannels.length >= MAX_JOINED_CHANNELS) return { error: `Límite de ${MAX_JOINED_CHANNELS} canales alcanzado` }
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