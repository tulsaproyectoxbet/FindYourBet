import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { isAdminUserId } from '../../../../lib/adminUsers'

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
  const [lastMessages, setLastMessages] = useState({})
  const [loading, setLoading] = useState(true)
  const hasLoadedRef = useRef(false)

  // Depèn de user?.id (primitiu estable). Si depenia de `user` (objecte),
  // qualsevol esdeveniment d'auth re-disparava la query encara que la sessió
  // fos la mateixa, deixant l'usuari amb una UI buida durant 10s de safety timer
  // si l'API anava lenta. Ara només refrescarem si l'usuari realment canvia.
  useEffect(() => {
    if (!user?.id || user.id === 'dev-skip') { setLoading(false); return }
    fetchChannels()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChannels = async ({ silent = false, attempt = 0 } = {}) => {
    // Només mostrem "loading" la primera vegada. Els refetches (join, leave,
    // create) són silenciosos perquè ja tenim dades que mostrar mentrestant.
    if (!silent && !hasLoadedRef.current && attempt === 0) setLoading(true)
    // Safety net: si una query es penja >5s, sortim del loading i intentem retry
    // automàtic (sovint el JWT s'ha refrescat i el segon intent va ràpid).
    const safetyTimer = setTimeout(() => {
      setLoading(false)
      if (attempt === 0 && !hasLoadedRef.current) fetchChannels({ silent: true, attempt: 1 })
    }, 5000)
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
        const channelIds = allChannels.map(c => c.id)
        const [{ data: mems }, lastMsgResults] = await Promise.all([
          // Inclou user_id per poder filtrar admins (fyourbet és invisible al recompte)
          supabase.from('channel_members').select('channel_id, user_id').in('channel_id', channelIds),
          Promise.all(channelIds.map(id =>
            supabase.from('channel_messages')
              .select('content, created_at')
              .eq('channel_id', id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(({ data }) => ({ id, data }))
          )),
        ])
        // Exclou admins del recompte de membres (fyourbet és "fantasma")
        for (const m of mems || []) {
          if (isAdminUserId(m.user_id)) continue
          counts[m.channel_id] = (counts[m.channel_id] || 0) + 1
        }
        // +1 per a l'owner (sempre compta, però si l'owner fos admin no comptaria)
        for (const c of allChannels) {
          if (isAdminUserId(c.owner_id)) continue
          counts[c.id] = (counts[c.id] || 0) + 1
        }
        setLastMessages(Object.fromEntries(lastMsgResults.map(r => [r.id, r.data])))
      }
      setMemberCounts(counts)
    } finally {
      clearTimeout(safetyTimer)
      hasLoadedRef.current = true
      setLoading(false)
    }
  }

  // channel_type: 'public' | 'free_private' | 'vip_weekly' | 'vip_monthly' | 'stakazo'
  // Els VIP i stakazo sempre són privats (is_private = true).
  // price/discountPrice en EUR. discountPrice genera un segon invite_code_discount
  // que el tipster passa al chat quan vol donar accés rebaixat a final de període.
  const createChannel = async (name, description, channelType = 'public', price = null, discountPrice = null) => {
    const trimmed = name.trim()
    if (!trimmed) return { error: 'El nombre es obligatorio' }
    if (trimmed.length > 30) return { error: 'El nombre del canal no puede superar los 30 caracteres' }
    if (myChannels.length >= MAX_OWN_CHANNELS) return { error: `Límite de ${MAX_OWN_CHANNELS} canales propios alcanzado` }

    const isPrivate = channelType !== 'public'
    const isVip = ['vip_weekly', 'vip_monthly', 'stakazo'].includes(channelType)

    if (isVip && (!price || parseFloat(price) <= 0)) {
      return { error: 'Los canales VIP y Stakazos requieren un precio de acceso' }
    }

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
        if (!c.deleted_at) return true
        if (c.owner_id === user.id) return false
        if (c.deleted_at > sevenDaysAgo) return true
        return false
      })
      if (blocking) return { error: 'Ese nombre de canal ya está en uso' }
    }

    const invite_code = generateInviteCode()
    // Segon codi d'invitació per al preu rebaixat (opcional, només per canals VIP)
    const invite_code_discount = (isVip && discountPrice && parseFloat(discountPrice) > 0)
      ? generateInviteCode()
      : null

    const { data, error } = await supabase
      .from('channels').insert({
        owner_id: user.id,
        name: trimmed,
        description: description.trim(),
        is_private: isPrivate,
        invite_code,
        channel_type: channelType,
        price: isVip ? parseFloat(price) : null,
        discount_price: invite_code_discount ? parseFloat(discountPrice) : null,
        invite_code_discount,
        currency: 'EUR',
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

  const searchChannels = async (query, { sport = '', language = '', sortBy = 'score', includePrivate = false } = {}) => {
    let q = supabase.from('channels')
      .select('*')
      .is('deleted_at', null)
      .ilike('name', query.trim() ? `%${query}%` : '%')
      .limit(20)
    // En mode normal només canals públics; en mode admin inclou privats/VIP/stakazo
    if (!includePrivate) q = q.eq('is_private', false)

    if (sport)    q = q.eq('sport', sport)
    if (language) q = q.eq('language', language)

    const { data: channels } = await q
    if (!channels?.length) return []

    const channelIds = channels.map(c => c.id)
    const ownerIds = [...new Set(channels.map(c => c.owner_id))]

    const [{ data: rawMems }, { data: profiles }, { data: bets }] = await Promise.all([
      // Inclou user_id per filtrar admins del recompte
      supabase.from('channel_members').select('channel_id, user_id').in('channel_id', channelIds),
      supabase.from('profiles').select('id, username, name, avatar_url').in('id', ownerIds),
      supabase.from('bets').select('user_id, status, stake, odds')
        .in('user_id', ownerIds).in('status', ['won', 'lost']).limit(500),
    ])

    const memberMap = {}
    for (const m of rawMems || []) {
      if (isAdminUserId(m.user_id)) continue
      memberMap[m.channel_id] = (memberMap[m.channel_id] || 0) + 1
    }
    // +1 propietari (excepte si l'owner és admin)
    const ownerMap = Object.fromEntries(channels.map(c => [c.id, c.owner_id]))
    for (const id of channelIds) {
      if (isAdminUserId(ownerMap[id])) continue
      memberMap[id] = (memberMap[id] || 0) + 1
    }
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

  // Busca un canal per codi d'invitació. Comprova primer el codi principal,
  // després el codi de descompte (si existeix). Retorna el canal amb accessType
  // i accessPrice per saber quin preu pagar al checkout de Stripe.
  const findChannelByCode = async (code) => {
    if (!code.trim()) return null
    const normalized = code.trim().toLowerCase()

    // Codi principal
    const { data: main } = await supabase.from('channels').select('*')
      .eq('invite_code', normalized).maybeSingle()
    if (main) return { ...main, accessType: 'full', accessPrice: main.price }

    // Codi de descompte (entrada tardana rebaixada)
    const { data: disc } = await supabase.from('channels').select('*')
      .eq('invite_code_discount', normalized).maybeSingle()
    if (disc) return { ...disc, accessType: 'discount', accessPrice: disc.discount_price }

    return null
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
    myChannels, joinedChannels, memberCounts, lastMessages, loading,
    createChannel, deleteChannel, updateChannel, searchChannels, findChannelByCode,
    joinChannel, leaveChannel, refetch: fetchChannels,
    MAX_OWN_CHANNELS, MAX_JOINED_CHANNELS
  }
}