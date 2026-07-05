import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { usePolling } from './usePolling'

// Clau localStorage per guardar quan l'usuari ha llegit per últim cop cada canal.
// markChannelRead marca TOT com llegit (timestamp = ara). Útil per accions explícites.
export function markChannelRead(userId, channelId) {
  if (!userId || !channelId) return
  localStorage.setItem(`fyb_ch_read_${userId}_${channelId}`, new Date().toISOString())
}

export function getChannelReadTs(userId, channelId) {
  if (!userId || !channelId) return ''
  return localStorage.getItem(`fyb_ch_read_${userId}_${channelId}`) || ''
}

// High-water mark: avança el marcador de llegit fins al created_at del missatge més
// nou que l'usuari REALMENT ha vist (scroll al viewport). Mai retrocedeix. Així el
// recompte de no llegits baixa a mesura que es llegeix, no de cop en obrir el canal.
// Els timestamps ISO es comparen lexicogràficament de forma correcta.
export function advanceChannelRead(userId, channelId, isoTs) {
  if (!userId || !channelId || !isoTs) return
  const key = `fyb_ch_read_${userId}_${channelId}`
  const cur = localStorage.getItem(key)
  if (!cur || isoTs > cur) localStorage.setItem(key, isoTs)
}

export function useUnreadChannelCount(userId) {
  // Map<channelId, unreadCount> — mateixa estructura que useDMs
  const [unreadCounts, setUnreadCounts] = useState(new Map())

  // Ref al canal que l'usuari té obert en aquest moment. fetchUnread el respecta:
  // no sobreescriu el valor live que ChatView ja ha reportat via setChannelCount,
  // evitant el flash del badge quan arriba un missatge just en obrir un canal.
  const activeChannelIdRef = useRef(null)
  // Ref sincronitzat amb l'estat per poder-lo llegir dins de callbacks sense closures obsoletes.
  const unreadCountsRef = useRef(new Map())
  useEffect(() => { unreadCountsRef.current = unreadCounts }, [unreadCounts])

  // Marca un canal com llegit immediatament (localStorage + state) sense esperar el poll
  const markRead = useCallback((channelId) => {
    markChannelRead(userId, channelId)
    setUnreadCounts(prev => {
      const next = new Map(prev)
      next.delete(channelId)
      return next
    })
  }, [userId])

  const fetchUnread = useCallback(async () => {
    if (!userId) return

    const [{ data: own }, { data: memberships }] = await Promise.all([
      supabase.from('channels').select('id').eq('owner_id', userId).is('deleted_at', null),
      supabase.from('channel_members').select('channel_id').eq('user_id', userId),
    ])

    const allIds = [...new Set([
      ...(own || []).map(c => c.id),
      ...(memberships || []).map(m => m.channel_id),
    ])]

    if (!allIds.length) { setUnreadCounts(new Map()); return }

    // Per cada canal: compte missatges d'altri posteriors a l'últim read.
    // El canal actiu (obert a ChatView) s'omet de la query: el seu recompte live
    // el governa setChannelCount (ChatView via IntersectionObserver), no localStorage.
    // Sense aquest skip, fetchUnread podia sobreescriure'l amb dades de localStorage
    // desfasades i causar un flash de badge en obrir el canal.
    const activeId = activeChannelIdRef.current
    const results = await Promise.all(
      allIds.map(id => {
        if (id === activeId) {
          return Promise.resolve({ id, count: unreadCountsRef.current.get(id) || 0 })
        }
        const lastRead = localStorage.getItem(`fyb_ch_read_${userId}_${id}`)
        let query = supabase.from('channel_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', id)
          .neq('user_id', userId)
        if (lastRead) query = query.gt('created_at', lastRead)
        return query.then(({ count }) => ({ id, count: count || 0 }))
      })
    )

    const newMap = new Map()
    for (const { id, count } of results) {
      if (count > 0) newMap.set(id, count)
    }
    setUnreadCounts(newMap)
  }, [userId])

  useEffect(() => { if (userId) fetchUnread() }, [userId, fetchUnread])

  // Realtime: actualitza els no llegits immediatament quan arriba un missatge nou
  // a qualsevol canal (RLS filtra automàticament els canals als quals l'usuari té accés).
  // Mateix patró que useDMs per als DMs.
  useEffect(() => {
    if (!userId) return
    const sub = supabase.channel(`ch-unread-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channel_messages',
      }, () => fetchUnread())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [userId, fetchUnread])

  usePolling(fetchUnread, 30000, !!userId)

  // Sobreescriu el comptador d'un canal concret amb un valor calculat localment
  // (ChatView reporta els no llegits restants en temps real mentre l'usuari fa scroll).
  const setChannelCount = useCallback((channelId, count) => {
    setUnreadCounts(prev => {
      const cur = prev.get(channelId) || 0
      if (cur === count) return prev
      const next = new Map(prev)
      if (count > 0) next.set(channelId, count)
      else next.delete(channelId)
      return next
    })
  }, [])

  // Informa quin canal és obert ara. Cridar amb null en tancar.
  const setActiveChannel = useCallback((channelId) => {
    activeChannelIdRef.current = channelId || null
  }, [])

  return {
    count: unreadCounts.size,
    unreadIds: new Set(unreadCounts.keys()),  // backward compat
    unreadCounts,
    markRead,
    setChannelCount,
    setActiveChannel,
    refetch: fetchUnread,
  }
}
