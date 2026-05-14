import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'

export function useMessages(channelId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const channelIdRef = useRef(channelId)

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelIdRef.current)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!channelId) { setLoading(false); return }
    channelIdRef.current = channelId
    fetchMessages()
    const interval = setInterval(fetchMessages, 2000)
    return () => clearInterval(interval)
  }, [channelId])

  const sendMessage = async (content, userId) => {
    if (!content.trim()) return
    await supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString()
    })
    await fetchMessages()
  }

  return { messages, loading, sendMessage }
}
