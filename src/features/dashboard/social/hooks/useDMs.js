import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePolling } from '../../../../hooks/usePolling'

export function useDMs(currentUserId) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!currentUserId) return
    fetchConversations(false)
  }, [currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  usePolling(useCallback(() => fetchConversations(false), [currentUserId]), 15000, !!currentUserId) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimitzat: 4 queries en total en comptes de 1 + N×3
  const fetchConversations = async (cancelled = false) => {
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
    const { data: convs } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })

    if (cancelled) return
    if (!convs?.length) {
      setConversations([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    const otherIds = [...new Set(convs.map(c => c.user1_id === currentUserId ? c.user2_id : c.user1_id))]
    const convIds = convs.map(c => c.id)

    // 3 queries paral·leles en comptes de N×3 seqüencials
    const [{ data: profiles }, lastMsgResults, { data: unreadMsgs }] = await Promise.all([
      supabase.from('profiles').select('id, username, name, avatar_url').in('id', otherIds),
      // Última missatge per conversa — en paral·lel però cada una és 1 query
      Promise.all(convIds.map(id =>
        supabase.from('direct_messages')
          .select('conversation_id, content, created_at, sender_id')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => ({ id, data }))
      )),
      // Tots els no llegits d'un cop
      supabase.from('direct_messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', currentUserId)
        .is('read_at', null),
    ])

    if (cancelled) return

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const lastMsgMap = Object.fromEntries(lastMsgResults.map(r => [r.id, r.data]))
    const unreadMap = {}
    for (const msg of (unreadMsgs || [])) {
      unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] || 0) + 1
    }

    const enriched = convs.map(conv => {
      const otherId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id
      const profile = profileMap[otherId] || null
      const lastMsg = lastMsgMap[conv.id] || null
      const unread = unreadMap[conv.id] || 0
      const isAccepted = conv.user1_id === currentUserId ? conv.user1_accepted : conv.user2_accepted
      const otherAccepted = conv.user1_id === currentUserId ? conv.user2_accepted : conv.user1_accepted

      return {
        ...conv,
        otherId,
        otherUsername: profile?.username || otherId.slice(0, 6),
        otherAvatarUrl: profile?.avatar_url || null,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: lastMsg?.created_at || conv.created_at,
        lastMessageIsOwn: lastMsg?.sender_id === currentUserId,
        unread,
        isAccepted,
        otherAccepted,
        isPending: !otherAccepted && conv.user1_id !== currentUserId,
      }
    })

    const total = enriched.reduce((sum, c) => sum + c.unread, 0)
    setUnreadCount(total)
    setConversations(enriched.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)))
    setLoading(false)
    } finally {
      clearTimeout(safetyTimer)
    }
  }

  const startConversation = async (otherUserId, isFollowing) => {
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(
        `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`
      )
      .single()

    if (existing) return existing

    const { data } = await supabase.from('dm_conversations').insert({
      user1_id: currentUserId,
      user2_id: otherUserId,
      user1_accepted: true,
      user2_accepted: isFollowing,
    }).select().single()

    await fetchConversations()
    return data
  }

  const acceptConversation = async (conversationId) => {
    const conv = conversations.find(c => c.id === conversationId)
    if (!conv) return
    const field = conv.user1_id === currentUserId ? 'user1_accepted' : 'user2_accepted'
    await supabase.from('dm_conversations').update({ [field]: true }).eq('id', conversationId)
    // Actualitza l'estat local sense recarregar tot
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, isAccepted: true } : c
    ))
  }

  const sendMessage = async (conversationId, content) => {
    if (!content.trim()) return
    await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: content.trim(),
    })
    // Actualitza l'últim missatge localment sense recarregar tot
    const now = new Date().toISOString()
    setConversations(prev =>
      prev.map(c => c.id === conversationId
        ? { ...c, lastMessage: content.trim(), lastMessageAt: now, lastMessageIsOwn: true }
        : c
      ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    )
  }

  const fetchMessages = async (conversationId) => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    // Marca com llegits
    await supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .is('read_at', null)

    // Actualitza unread localment
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, unread: 0 } : c
    ))
    setUnreadCount(prev => Math.max(0, prev - (conversations.find(c => c.id === conversationId)?.unread || 0)))

    return data || []
  }

  const blockUser = async (conversationId) => {
    await supabase.from('dm_conversations').delete().eq('id', conversationId)
    setConversations(prev => prev.filter(c => c.id !== conversationId))
  }

  return {
    conversations, loading, unreadCount,
    startConversation, acceptConversation,
    sendMessage, fetchMessages, blockUser,
    refetch: fetchConversations,
  }
}
