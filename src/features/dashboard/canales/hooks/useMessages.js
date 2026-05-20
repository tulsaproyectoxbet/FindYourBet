import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePolling } from '../../../../hooks/usePolling'

export function useMessages(channelId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(async () => {
    if (!channelId) return
    const { data } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) {
      setMessages(data)
      setLoading(false)
    }
  }, [channelId])

  useEffect(() => {
    if (!channelId) { setLoading(false); return }
    setLoading(true)
    fetchMessages()
  }, [channelId, fetchMessages])

  usePolling(fetchMessages, 5000, !!channelId)

  const sendMessage = async (content, userId) => {
    if (!content.trim()) return

    // Optimistic update — missatge visible immediatament
    const optimistic = {
      id: `opt-${Date.now()}`,
      channel_id: channelId,
      user_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    await supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString(),
    })

    // Sync amb dades reals (substitueix l'optimistic per l'ID real)
    const { data } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data)
  }

  return { messages, loading, sendMessage }
}
