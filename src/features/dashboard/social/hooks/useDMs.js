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

  // Realtime: actualitza la llista quan arriba un DM nou a qualsevol conversa.
  // Si la conversa estava oculta (usuari l'havia esborrat) i l'altre torna a escriure,
  // la torna a fer visible abans de fer el fetch — garanteix que el missatge aparegui.
  useEffect(() => {
    if (!currentUserId) return
    const channel = supabase.channel(`dm-list-${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
      }, async (payload) => {
        const convId = payload.new?.conversation_id
        const senderId = payload.new?.sender_id
        if (convId && senderId && senderId !== currentUserId) {
          const { data: conv } = await supabase
            .from('dm_conversations')
            .select('id, user1_id, user1_hidden_at, user2_hidden_at')
            .eq('id', convId)
            .maybeSingle()
          if (conv) {
            const hiddenField = conv.user1_id === currentUserId ? 'user1_hidden_at' : 'user2_hidden_at'
            if (conv[hiddenField]) {
              await supabase.from('dm_conversations')
                .update({ [hiddenField]: null })
                .eq('id', convId)
            }
          }
        }
        fetchConversations(false)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de fallback si Realtime es desconnecta
  usePolling(useCallback(() => fetchConversations(false), [currentUserId]), 30000, !!currentUserId) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimitzat: 4 queries en total en comptes de 1 + N×3
  const fetchConversations = async (cancelled = false) => {
    // Safety timer + try/catch/finally (regla 3 CLAUDE.md): el finally SEMPRE apaga
    // el loading. Abans el finally només netejava el timer, així que un error abans
    // dels setLoading(false) inline deixava el spinner penjat per sempre.
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
    const { data: allConvs } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })

    if (cancelled) return

    // Filtra les converses que l'usuari ha eliminat (soft-delete per usuari).
    // L'altra persona segueix veient-les amb tots els missatges intactes.
    const convs = (allConvs || []).filter(c => {
      const hiddenAt = c.user1_id === currentUserId ? c.user1_hidden_at : c.user2_hidden_at
      return !hiddenAt
    })

    if (!convs.length) {
      setConversations([])
      setUnreadCount(0)
      return
    }

    const otherIds = [...new Set(convs.map(c => c.user1_id === currentUserId ? c.user2_id : c.user1_id))]
    const convIds = convs.map(c => c.id)

    // 3 queries paral·leles en comptes de N×3 seqüencials
    const [{ data: profiles }, lastMsgResults, { data: unreadMsgs }] = await Promise.all([
      supabase.from('profiles').select('id, username, name, avatar_url, is_verified').in('id', otherIds),
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

      // clearedAt: quan l'usuari va esborrar el xat. Els missatges anteriors es filtren
      // a fetchMessages. Sobreviu al re-unhide perquè no es neteja mai.
      const clearedAt = conv.user1_id === currentUserId ? conv.user1_cleared_at : conv.user2_cleared_at

      return {
        ...conv,
        otherId,
        otherUsername: profile?.username || otherId.slice(0, 6),
        otherAvatarUrl: profile?.avatar_url || null,
        otherIsVerified: profile?.is_verified || false,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: lastMsg?.created_at || conv.created_at,
        lastMessageIsOwn: lastMsg?.sender_id === currentUserId,
        unread,
        isAccepted,
        otherAccepted,
        isPending: !otherAccepted && conv.user1_id !== currentUserId,
        clearedAt: clearedAt || null,
      }
    })

    const total = enriched.reduce((sum, c) => sum + c.unread, 0)
    setUnreadCount(total)
    setConversations(enriched.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)))
    } catch {
      // Empassat: el finally garanteix que el loading s'apaga.
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const startConversation = async (otherUserId, isFollowing) => {
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(
        `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`
      )
      .maybeSingle()

    if (existing) {
      const isUser1       = existing.user1_id === currentUserId
      const hiddenField   = isUser1 ? 'user1_hidden_at' : 'user2_hidden_at'
      const acceptedField = isUser1 ? 'user1_accepted'  : 'user2_accepted'
      const myAccepted    = isUser1 ? existing.user1_accepted : existing.user2_accepted

      // Si estava oculta O jo no havia acceptat: actualitza.
      // Jo estic iniciant activament → la conversa va al meu General sense barra de solicitud,
      // independentment de si segueixo o no l'altra persona.
      if (existing[hiddenField] || !myAccepted) {
        await supabase.from('dm_conversations').update({
          [hiddenField]:   null,
          [acceptedField]: true,
        }).eq('id', existing.id)
        await fetchConversations()
      }
      return existing
    }

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

    // Si la conversa no estava acceptada, auto-acceptar en enviar el primer missatge.
    // Significa "he respost = accepto la relació". Queda fixat a General independentment
    // de si en el futur deixem de seguir-nos — la conversa és "consolidada".
    const conv = conversations.find(c => c.id === conversationId)
    if (conv && !conv.isAccepted) {
      const acceptedField = conv.user1_id === currentUserId ? 'user1_accepted' : 'user2_accepted'
      await supabase.from('dm_conversations')
        .update({ [acceptedField]: true })
        .eq('id', conversationId)
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, isAccepted: true } : c))
    }

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

  const fetchMessages = async (conversationId, clearedAt = null) => {
    // NOMÉS llegim. Ja NO marquem tot com llegit en obrir: els missatges es marquen
    // un per un quan l'usuari els veu (scroll), via markDmRead des de DMView.
    // clearedAt: si l'usuari havia esborrat el xat, nomes retorna missatges posteriors
    // a aquell timestamp (els anteriors queden al Supabase però son invisibles per a ell).
    let query = supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (clearedAt) query = query.gt('created_at', clearedAt)
    const { data } = await query
    return data || []
  }

  // Marca com llegits NOMÉS els missatges que l'usuari ha vist realment (scroll al
  // viewport). read_at també alimenta els ✓✓ del remitent, així que els receipts
  // passen a ser exactes. Baixa el comptador de no llegits de la conversa.
  const markDmRead = async (conversationId, messageIds) => {
    if (!messageIds?.length) return
    await supabase.from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds)
      .neq('sender_id', currentUserId)
      .is('read_at', null)
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, unread: Math.max(0, (c.unread || 0) - messageIds.length) } : c
    ))
    setUnreadCount(prev => Math.max(0, prev - messageIds.length))
  }

  const blockUser = async (conversationId) => {
    const conv = conversations.find(c => c.id === conversationId)
    if (!conv) return
    // Soft-delete per a l'usuari que elimina:
    // - hidden_at: amaga la conversa de la barra (es pot netejar si reapareix)
    // - cleared_at: cutoff permanent de missatges (mai es resetejarà)
    // - accepted: es reseteja a false perquè, si la conversa reapareix, torni a
    //   passar pel filtre de solicituds en comptes d'anar directament a General.
    const now = new Date().toISOString()
    const isUser1 = conv.user1_id === currentUserId
    await supabase.from('dm_conversations').update({
      [isUser1 ? 'user1_hidden_at'  : 'user2_hidden_at']:  now,
      [isUser1 ? 'user1_cleared_at' : 'user2_cleared_at']: now,
      [isUser1 ? 'user1_accepted'   : 'user2_accepted']:   false,
    }).eq('id', conversationId)
    setConversations(prev => prev.filter(c => c.id !== conversationId))
  }

  return {
    conversations, loading, unreadCount,
    startConversation, acceptConversation,
    sendMessage, fetchMessages, markDmRead, blockUser,
    refetch: fetchConversations,
  }
}
