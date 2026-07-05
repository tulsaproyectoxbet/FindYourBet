import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePolling } from '../../../../hooks/usePolling'

// Paritat amb useUnreadChannelCount: manté un Map<convId, nº missatges no llegits>.
// El badge de la sidebar mostra el NOMBRE DE CONVERSES amb no llegits (map.size),
// igual que Canales mostra el nombre de canals amb no llegits.
export function useUnreadDMCount(userId) {
  const [unreadByConv, setUnreadByConv] = useState(new Map())

  const fetchCount = useCallback(async () => {
    if (!userId) return
    const { data: allConvs } = await supabase
      .from('dm_conversations')
      .select('id, user1_id, user1_hidden_at, user2_hidden_at, user1_cleared_at, user2_cleared_at')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    // Exclou converses esborrades (hidden_at set) — no han de comptar al badge.
    const visibleConvs = (allConvs || []).filter(c => {
      const hiddenAt = c.user1_id === userId ? c.user1_hidden_at : c.user2_hidden_at
      return !hiddenAt
    })
    if (!visibleConvs.length) { setUnreadByConv(new Map()); return }

    // Mapa convId → clearedAt de l'usuari (cutoff de missatges visibles).
    const clearedAtMap = Object.fromEntries(visibleConvs.map(c => [
      c.id,
      c.user1_id === userId ? c.user1_cleared_at : c.user2_cleared_at,
    ]))

    // Una sola query: totes les files no llegides d'altri; comptem per conversa al client.
    const { data: rows } = await supabase
      .from('direct_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', visibleConvs.map(c => c.id))
      .neq('sender_id', userId)
      .is('read_at', null)

    const map = new Map()
    for (const r of (rows || [])) {
      const clearedAt = clearedAtMap[r.conversation_id]
      // Salta missatges anteriors al tall de l'esborrat (clearedAt) — l'usuari no els veu.
      if (clearedAt && r.created_at <= clearedAt) continue
      map.set(r.conversation_id, (map.get(r.conversation_id) || 0) + 1)
    }
    setUnreadByConv(map)
  }, [userId])

  // Sobreescriu el comptador d'una conversa amb un valor calculat en viu (DMView
  // reporta els no llegits restants mentre l'usuari fa scroll).
  const setConvCount = useCallback((convId, count) => {
    setUnreadByConv(prev => {
      const cur = prev.get(convId) || 0
      if (cur === count) return prev
      const next = new Map(prev)
      if (count > 0) next.set(convId, count)
      else next.delete(convId)
      return next
    })
  }, [])

  useEffect(() => { if (userId) fetchCount() }, [userId, fetchCount])
  usePolling(fetchCount, 30000, !!userId)

  return { count: unreadByConv.size, unreadByConv, setConvCount, refetch: fetchCount }
}
