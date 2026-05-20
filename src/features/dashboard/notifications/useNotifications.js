import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePolling } from '../../../hooks/usePolling'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read_at).length)
      }
    } catch {
      // silent — no bloqueja la UI
    }
  }, [userId])

  useEffect(() => { if (userId) fetchNotifications() }, [userId, fetchNotifications])

  usePolling(fetchNotifications, 30000, !!userId)

  const markRead = async (id) => {
    const now = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: now }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    const now = new Date().toISOString()
    await supabase.from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markRead, markAllRead, refetch: fetchNotifications }
}

export async function insertNotification({ userId, type, fromUserId, fromUsername, messageId, preview }) {
  if (!userId || userId === fromUserId) return
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    from_user_id: fromUserId,
    from_username: fromUsername || 'alguien',
    message_id: messageId || null,
    preview: preview || null,
    created_at: new Date().toISOString(),
  })
}
