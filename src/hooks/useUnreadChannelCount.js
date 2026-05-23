import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { usePolling } from './usePolling'

// Clau localStorage per guardar quan l'usuari ha llegit per últim cop cada canal
export function markChannelRead(userId, channelId) {
  if (!userId || !channelId) return
  localStorage.setItem(`fyb_ch_read_${userId}_${channelId}`, new Date().toISOString())
}

export function useUnreadChannelCount(userId) {
  const [unreadIds, setUnreadIds] = useState(new Set())

  const fetchUnread = useCallback(async () => {
    if (!userId) return

    // Canals propis + canals on sóc membre
    const [{ data: own }, { data: memberships }] = await Promise.all([
      supabase.from('channels').select('id').eq('owner_id', userId).is('deleted_at', null),
      supabase.from('channel_members').select('channel_id').eq('user_id', userId),
    ])

    const allIds = [...new Set([
      ...(own || []).map(c => c.id),
      ...(memberships || []).map(m => m.channel_id),
    ])]

    if (!allIds.length) { setUnreadIds(new Set()); return }

    // Últim missatge d'altri per cada canal — una query per canal (polling cada 30s)
    const results = await Promise.all(
      allIds.map(id =>
        supabase.from('channel_messages')
          .select('channel_id, created_at')
          .eq('channel_id', id)
          .neq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => ({ id, lastMsg: data }))
      )
    )

    const newUnread = new Set()
    for (const { id, lastMsg } of results) {
      if (!lastMsg) continue
      const lastRead = localStorage.getItem(`fyb_ch_read_${userId}_${id}`)
      if (!lastRead || new Date(lastMsg.created_at) > new Date(lastRead)) {
        newUnread.add(id)
      }
    }
    setUnreadIds(newUnread)
  }, [userId])

  useEffect(() => { if (userId) fetchUnread() }, [userId, fetchUnread])
  usePolling(fetchUnread, 30000, !!userId)

  return { count: unreadIds.size, unreadIds }
}
