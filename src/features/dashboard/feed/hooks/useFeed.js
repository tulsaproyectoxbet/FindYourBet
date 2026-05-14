import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { insertNotification } from '../../notifications/useNotifications'

function parseBet(content) {
  try {
    return JSON.parse(content.slice(6)) // remove '[BET]:'
  } catch {
    return null
  }
}

function scorePost(post) {
  const ageDays = (Date.now() - new Date(post.created_at).getTime()) / 86400000
  return post.likeCount * 2 + post.commentCount * 3 + Math.max(0, 30 - ageDays) * 2
}

async function enrichMessages(messages, currentUserId) {
  if (!messages.length) return []

  const messageIds = messages.map(m => m.id)
  const channelIds = [...new Set(messages.map(m => m.channel_id))]
  const userIds = [...new Set(messages.map(m => m.user_id))]

  const [
    { data: channels },
    { data: profiles },
    { data: likes },
    { data: comments },
    { data: myLikes },
  ] = await Promise.all([
    supabase.from('channels').select('id, name, invite_code').in('id', channelIds),
    supabase.from('profiles').select('id, username, name, avatar_url').in('id', userIds),
    supabase.from('post_likes').select('message_id').in('message_id', messageIds),
    supabase.from('post_comments').select('message_id').in('message_id', messageIds),
    supabase.from('post_likes').select('message_id').in('message_id', messageIds).eq('user_id', currentUserId),
  ])

  const channelMap = Object.fromEntries((channels || []).map(c => [c.id, c]))
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const likeMap = {}
  const commentMap = {}
  const myLikeSet = new Set((myLikes || []).map(l => l.message_id))

  for (const l of (likes || [])) likeMap[l.message_id] = (likeMap[l.message_id] || 0) + 1
  for (const c of (comments || [])) commentMap[c.message_id] = (commentMap[c.message_id] || 0) + 1

  return messages
    .map(m => ({
      ...m,
      bet: parseBet(m.content),
      channel: channelMap[m.channel_id] || null,
      profile: profileMap[m.user_id] || null,
      likeCount: likeMap[m.id] || 0,
      commentCount: commentMap[m.id] || 0,
      hasLiked: myLikeSet.has(m.id),
    }))
    .filter(m => m.bet !== null)
}

export function useFeed(currentUserId) {
  const [followingFeed, setFollowingFeed] = useState([])
  const [discoverFeed, setDiscoverFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [myUsername, setMyUsername] = useState('')

  useEffect(() => {
    if (!currentUserId) return
    supabase.from('profiles').select('username').eq('id', currentUserId).single()
      .then(({ data }) => { if (data) setMyUsername(data.username) })
  }, [currentUserId])

  const fetchFeed = async () => {
    if (!currentUserId) return

    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', currentUserId)

    const joinedIds = (memberships || []).map(m => m.channel_id)

    const followingPromise = joinedIds.length > 0
      ? supabase.from('channel_messages').select('*')
          .in('channel_id', joinedIds)
          .like('content', '[BET]:%')
          .neq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] })

    const publicChannelsPromise = supabase.from('channels').select('id').eq('is_private', false)

    const [followingResult, publicResult] = await Promise.all([followingPromise, publicChannelsPromise])

    const publicIds = (publicResult.data || [])
      .map(c => c.id)
      .filter(id => !joinedIds.includes(id))

    const discoverResult = publicIds.length > 0
      ? await supabase.from('channel_messages').select('*')
          .in('channel_id', publicIds)
          .like('content', '[BET]:%')
          .neq('user_id', currentUserId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: [] }

    const [enrichedFollowing, enrichedDiscover] = await Promise.all([
      enrichMessages(followingResult.data || [], currentUserId),
      enrichMessages(discoverResult.data || [], currentUserId),
    ])

    setFollowingFeed(enrichedFollowing)
    setDiscoverFeed(enrichedDiscover.sort((a, b) => scorePost(b) - scorePost(a)))
    setLoading(false)
  }

  useEffect(() => {
    if (!currentUserId) return
    fetchFeed()
    const interval = setInterval(fetchFeed, 30000)
    return () => clearInterval(interval)
  }, [currentUserId])

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
      const post = [...followingFeed, ...discoverFeed].find(p => p.id === messageId)
      if (post) {
        await insertNotification({
          userId: post.user_id,
          type: 'like',
          fromUserId: currentUserId,
          fromUsername: myUsername,
          messageId,
          preview: post.bet?.event || '',
        })
      }
    }
  }

  const fetchComments = async (messageId) => {
    const { data: comments } = await supabase
      .from('post_comments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true })

    if (!comments?.length) return []

    const userIds = [...new Set(comments.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    return comments.map(c => ({ ...c, profile: profileMap[c.user_id] || null }))
  }

  const addComment = async (messageId, content) => {
    if (!content.trim()) return
    await supabase.from('post_comments').insert({
      message_id: messageId,
      user_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
    })
    const post = [...followingFeed, ...discoverFeed].find(p => p.id === messageId)
    if (post) {
      await insertNotification({
        userId: post.user_id,
        type: 'comment',
        fromUserId: currentUserId,
        fromUsername: myUsername,
        messageId,
        preview: content.trim().slice(0, 60),
      })
    }

    const update = feed => feed.map(p =>
      p.id === messageId ? { ...p, commentCount: p.commentCount + 1 } : p
    )
    setFollowingFeed(prev => update(prev))
    setDiscoverFeed(prev => update(prev))
  }

  return { followingFeed, discoverFeed, loading, toggleLike, fetchComments, addComment, refresh: fetchFeed }
}
