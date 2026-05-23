import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePolling } from '../../../../hooks/usePolling'
import { markChannelRead } from '../../../../hooks/useUnreadChannelCount'

export function useMessages(channelId, userId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const recordedRef = useRef(new Set())

  // Reset tracked IDs when channel changes
  useEffect(() => { recordedRef.current = new Set() }, [channelId])

  // Called by IntersectionObserver when a message enters the viewport
  const recordView = useCallback((msgId) => {
    if (!userId || userId === 'dev-skip') return
    if (msgId.startsWith('opt-') || recordedRef.current.has(msgId)) return
    recordedRef.current.add(msgId)
    supabase
      .from('channel_message_views')
      .upsert([{ message_id: msgId, user_id: userId }], { ignoreDuplicates: true })
      .then()
  }, [userId])

  const fetchAndEnrich = useCallback(async () => {
    if (!channelId) return null
    const { data } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (!data) return null

    // Fetch view counts via aggregation view
    const msgIds = data.map(m => m.id)
    const { data: counts } = await supabase
      .from('channel_message_view_counts')
      .select('message_id, view_count')
      .in('message_id', msgIds)

    const countMap = {}
    ;(counts || []).forEach(r => { countMap[r.message_id] = Number(r.view_count) })

    return data.map(m => ({ ...m, view_count: countMap[m.id] || 0 }))
  }, [channelId])

  const fetchMessages = useCallback(async () => {
    const enriched = await fetchAndEnrich()
    if (enriched) {
      setMessages(enriched)
      setLoading(false)
      // Marca el canal com llegit cada vegada que es carreguen missatges
      markChannelRead(userId, channelId)
    }
  }, [fetchAndEnrich, userId, channelId])

  useEffect(() => {
    if (!channelId) { setLoading(false); return }
    setLoading(true)
    fetchMessages()
  }, [channelId, fetchMessages])

  usePolling(fetchMessages, 5000, !!channelId)

  const sendMessage = async (content, sendUserId) => {
    if (!content.trim()) return

    const optimistic = {
      id: `opt-${Date.now()}`,
      channel_id: channelId,
      user_id: sendUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      view_count: 0,
    }
    setMessages(prev => [...prev, optimistic])

    await supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: sendUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
    })

    const enriched = await fetchAndEnrich()
    if (enriched) setMessages(enriched)
  }

  return { messages, loading, sendMessage, recordView }
}
