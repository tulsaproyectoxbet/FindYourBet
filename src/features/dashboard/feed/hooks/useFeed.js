import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { insertNotification } from '../../notifications/useNotifications'
import { usePolling } from '../../../../hooks/usePolling'

function parseBet(content) {
  try { return JSON.parse(content.slice(6)) } catch { return null }
}

// — Seen tracking via localStorage —
function loadSeen(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(`fyb_seen_${userId}`) || '[]')) }
  catch { return new Set() }
}

function persistSeen(userId, id) {
  try {
    const seen = loadSeen(userId)
    if (seen.has(id)) return
    seen.add(id)
    localStorage.setItem(`fyb_seen_${userId}`, JSON.stringify([...seen].slice(-600)))
  } catch {}
}

// — Algorithm score —
function scorePost(post, followingSet, userSports, tipsterYields) {
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000
  let score = 0

  // Recency: exponential decay (max 60 pts, halves every 24h)
  score += 60 * Math.pow(0.5, ageHours / 24)

  // Engagement
  score += post.likeCount * 4
  score += post.commentCount * 5

  // Sport match with user history
  if (post.bet?.sport && userSports.has(post.bet.sport)) score += 20

  // Following bonus
  if (followingSet.has(post.user_id)) score += 35

  // Tipster yield quality (capped at 25 pts)
  const yld = tipsterYields[post.user_id]
  if (yld != null && yld > 0) score += Math.min(yld * 1.5, 25)

  return score
}

async function enrichMessages(messages, currentUserId) {
  if (!messages.length) return []

  const messageIds = messages.map(m => m.id)
  const channelIds = [...new Set(messages.map(m => m.channel_id))]
  const userIds = [...new Set(messages.map(m => m.user_id))]

  // Collect embedded bet IDs to fetch live statuses
  const betIdByMsgId = {}
  for (const m of messages) {
    const bet = parseBet(m.content)
    if (bet?.id) betIdByMsgId[m.id] = bet.id
  }
  const betIds = [...new Set(Object.values(betIdByMsgId))]

  const [
    { data: channels },
    { data: profiles },
    { data: likes },
    { data: comments },
    { data: myLikes },
    { data: liveBets },
  ] = await Promise.all([
    supabase.from('channels').select('id, name, invite_code').in('id', channelIds),
    supabase.from('profiles').select('id, username, name, avatar_url, is_verified').in('id', userIds),
    supabase.from('post_likes').select('message_id').in('message_id', messageIds),
    supabase.from('post_comments').select('message_id').in('message_id', messageIds),
    supabase.from('post_likes').select('message_id').in('message_id', messageIds).eq('user_id', currentUserId),
    betIds.length
      ? supabase.from('bets').select('id, status').in('id', betIds)
      : Promise.resolve({ data: [] }),
  ])

  const channelMap = Object.fromEntries((channels || []).map(c => [c.id, c]))
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const likeMap = {}
  const commentMap = {}
  const myLikeSet = new Set((myLikes || []).map(l => l.message_id))
  const liveStatusMap = Object.fromEntries((liveBets || []).map(b => [b.id, b.status]))

  for (const l of (likes || [])) likeMap[l.message_id] = (likeMap[l.message_id] || 0) + 1
  for (const c of (comments || [])) commentMap[c.message_id] = (commentMap[c.message_id] || 0) + 1

  return messages
    .map(m => {
      const bet = parseBet(m.content)
      if (!bet) return null
      const liveStatus = bet.id ? (liveStatusMap[bet.id] ?? bet.status) : bet.status
      // Only show pending bets
      if (liveStatus !== 'pending') return null
      return {
        ...m,
        bet: { ...bet, status: liveStatus },
        channel: channelMap[m.channel_id] || null,
        profile: profileMap[m.user_id] || null,
        likeCount: likeMap[m.id] || 0,
        commentCount: commentMap[m.id] || 0,
        hasLiked: myLikeSet.has(m.id),
      }
    })
    .filter(Boolean)
}

export function useFeed(currentUserId) {
  const [followingFeed, setFollowingFeed] = useState([])
  const [discoverFeed, setDiscoverFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [myUsername, setMyUsername] = useState('')
  const [followingAllSeen, setFollowingAllSeen] = useState(false)
  const [discoverAllSeen, setDiscoverAllSeen] = useState(false)

  useEffect(() => {
    if (!currentUserId) return
    supabase.from('profiles').select('username').eq('id', currentUserId).single()
      .then(({ data }) => { if (data) setMyUsername(data.username) })
  }, [currentUserId])

  // Mark a post as seen — writes to localStorage; filtering applies on next fetch
  const markSeen = useCallback((messageId) => {
    if (currentUserId && messageId) persistSeen(currentUserId, messageId)
  }, [currentUserId])

  const fetchFeed = async () => {
    if (!currentUserId) return
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      // Fetch context needed for scoring
      const [
        { data: memberships },
        { data: following },
        { data: userBets },
      ] = await Promise.all([
        supabase.from('channel_members').select('channel_id').eq('user_id', currentUserId),
        supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        supabase.from('bets').select('sport').eq('user_id', currentUserId).neq('status', 'pending').limit(200),
      ])

      const joinedIds = (memberships || []).map(m => m.channel_id)
      const followingSet = new Set((following || []).map(f => f.following_id))
      const userSports = new Set((userBets || []).map(b => b.sport).filter(Boolean))

      // Siguiendo: channels user has joined
      const followingPromise = joinedIds.length > 0
        ? supabase.from('channel_messages').select('*')
            .in('channel_id', joinedIds)
            .like('content', '[BET]:%')
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(80)
        : Promise.resolve({ data: [] })

      // Para ti: public channels NOT joined
      const publicChannelsPromise = supabase.from('channels').select('id').eq('is_private', false)

      const [followingResult, publicResult] = await Promise.all([followingPromise, publicChannelsPromise])

      const publicIds = (publicResult.data || []).map(c => c.id).filter(id => !joinedIds.includes(id))

      const discoverResult = publicIds.length > 0
        ? await supabase.from('channel_messages').select('*')
            .in('channel_id', publicIds)
            .like('content', '[BET]:%')
            .neq('user_id', currentUserId)
            .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(100)
        : { data: [] }

      const [enrichedFollowing, enrichedDiscover] = await Promise.all([
        enrichMessages(followingResult.data || [], currentUserId),
        enrichMessages(discoverResult.data || [], currentUserId),
      ])

      // Compute tipster yields for algorithm scoring
      const tipsterIds = [...new Set([...enrichedFollowing, ...enrichedDiscover].map(p => p.user_id))]
      let tipsterYields = {}
      if (tipsterIds.length) {
        // 'void' (nul, diners retornats) està exclòs del càlcul de yield
        const { data: tipsterBets } = await supabase.from('bets')
          .select('user_id, stake, odds, status')
          .in('user_id', tipsterIds)
          .in('status', ['won', 'lost'])
          .limit(500)
        const byTipster = {}
        for (const b of (tipsterBets || [])) {
          if (!byTipster[b.user_id]) byTipster[b.user_id] = []
          byTipster[b.user_id].push(b)
        }
        for (const [uid, bets] of Object.entries(byTipster)) {
          const stakeSum = bets.reduce((s, b) => s + (b.stake || 0), 0)
          const profit = bets.reduce((s, b) => s + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake), 0)
          tipsterYields[uid] = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
        }
      }

      // Score and sort
      const scored = arr => arr
        .map(p => ({ ...p, _score: scorePost(p, followingSet, userSports, tipsterYields) }))
        .sort((a, b) => b._score - a._score)

      const scoredFollowing = scored(enrichedFollowing)
      const scoredDiscover = scored(enrichedDiscover)

      // Apply seen filter (read fresh from localStorage)
      const seen = loadSeen(currentUserId)
      const unseenF = scoredFollowing.filter(p => !seen.has(p.id))
      const unseenD = scoredDiscover.filter(p => !seen.has(p.id))

      const fAllSeen = unseenF.length === 0 && scoredFollowing.length > 0
      const dAllSeen = unseenD.length === 0 && scoredDiscover.length > 0

      setFollowingFeed(fAllSeen ? scoredFollowing : unseenF)
      setFollowingAllSeen(fAllSeen)
      setDiscoverFeed(dAllSeen ? scoredDiscover : unseenD)
      setDiscoverAllSeen(dAllSeen)

    } catch {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentUserId) return
    fetchFeed()
  }, [currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  usePolling(fetchFeed, 60000, !!currentUserId)

  const toggleLike = async (messageId, currentlyLiked) => {
    const update = feed => feed.map(p =>
      p.id === messageId
        ? { ...p, hasLiked: !currentlyLiked, likeCount: p.likeCount + (currentlyLiked ? -1 : 1) }
        : p
    )
    setFollowingFeed(prev => update(prev))
    setDiscoverFeed(prev => update(prev))

    if (currentlyLiked) {
      await supabase.from('post_likes').delete().eq('message_id', messageId).eq('user_id', currentUserId)
    } else {
      await supabase.from('post_likes').insert({ message_id: messageId, user_id: currentUserId })
      // Busca el propietari del post — primer a l'estat, sinó a la DB (pot no estar al feed si el pick ja está resolt)
      let ownerId = [...followingFeed, ...discoverFeed].find(p => p.id === messageId)?.user_id
      if (!ownerId) {
        const { data: msg } = await supabase.from('channel_messages').select('user_id').eq('id', messageId).single()
        ownerId = msg?.user_id
      }
      if (ownerId) {
        await insertNotification({
          userId: ownerId, type: 'like', fromUserId: currentUserId,
          fromUsername: myUsername, messageId, preview: '',
        })
      }
    }
  }

  return {
    followingFeed, discoverFeed, loading, toggleLike,
    refresh: fetchFeed, markSeen,
    followingAllSeen, discoverAllSeen,
  }
}
