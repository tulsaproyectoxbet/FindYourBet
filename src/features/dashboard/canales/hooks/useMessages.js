import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../../lib/supabase'
import { usePolling } from '../../../../hooks/usePolling'
import { isAdminUserId } from '../../../../lib/adminUsers'

export function useMessages(channelId, userId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const recordedRef = useRef(new Set())
  // Evita el flash de "Cargando" en refetches (polling, realtime). Es reseteja
  // en canviar de canal perquè el nou canal sí que mostri el seu spinner inicial.
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    recordedRef.current = new Set()
    hasLoadedRef.current = false
  }, [channelId])

  const recordView = useCallback((msgId) => {
    if (!userId || userId === 'dev-skip') return
    // Stealth: els admins (fyourbet) no deixen rastre de visites
    if (isAdminUserId(userId)) return
    if (msgId.startsWith('opt-') || recordedRef.current.has(msgId)) return
    recordedRef.current.add(msgId)
    supabase
      .from('channel_message_views')
      .upsert([{ message_id: msgId, user_id: userId }], { ignoreDuplicates: true })
      .then()
  }, [userId])

  const fetchAndEnrich = useCallback(async () => {
    if (!channelId) return null
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(50)
    // Supabase no llança en timeout/error de xarxa: retorna { data: null }. Tornem null
    // perquè fetchMessages ho tracti com a fallada (retry) en lloc de buidar el xat.
    if (error || !data) return null

    const msgIds = data.map(m => m.id)
    // Bet IDs dels picks (columna extreta via trigger SQL)
    const betIds = [...new Set(data.map(m => m.bet_id).filter(Boolean))]

    // Les vistes són secundàries: si fallen, mostrem els missatges igualment.
    const [{ data: counts }, viewsResult] = await Promise.all([
      msgIds.length
        ? supabase.from('channel_message_view_counts').select('message_id, view_count').in('message_id', msgIds)
        : Promise.resolve({ data: [] }),
      // Total de vistes per bet (suma canal + feed + DMs)
      betIds.length
        ? supabase.rpc('get_bet_total_views_batch', { p_bet_ids: betIds })
        : Promise.resolve({ data: [] }),
    ])

    const countMap = {}
    ;(counts || []).forEach(r => { countMap[r.message_id] = Number(r.view_count) })

    // Map bet_id → total de vistes de totes les fonts
    const totalCountMap = {}
    ;(viewsResult.data || []).forEach(r => { totalCountMap[r.bet_id] = Number(r.view_count) })

    // La query retorna newest-first; invertim perquè el xat mostri oldest-top newest-bottom
    return data.reverse().map(m => ({
      ...m,
      // Per a picks: total de totes les fonts. Per a la resta: vistes del canal
      view_count: m.bet_id ? (totalCountMap[m.bet_id] || 0) : (countMap[m.id] || 0),
    }))
  }, [channelId])

  // Carrega missatges amb la protecció obligatòria (regla 3 del CLAUDE.md):
  // safety timer + try/catch/finally perquè el spinner MAI quedi penjat encara
  // que la petició faci timeout.
  const fetchMessages = useCallback(async () => {
    if (!channelId) { setLoading(false); return }
    // Spinner només el primer cop. Polling i realtime refetch són silenciosos.
    if (!hasLoadedRef.current) setLoading(true)
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      let enriched = await fetchAndEnrich()
      // Primer load fallit (timeout/error): un retry net abans de rendir-nos.
      if (!enriched && !hasLoadedRef.current) enriched = await fetchAndEnrich()
      if (enriched) {
        setMessages(enriched)
        // NOTA: ja no marquem tot el canal com llegit aquí. El marcador avança
        // a mesura que l'usuari fa scroll i veu els missatges (ChatView/observer),
        // perquè els no llegits persisteixin fins que realment s'hagin vist.
      }
    } catch {
      // Empassat: el finally garanteix que el loading s'apaga.
    } finally {
      clearTimeout(safetyTimer)
      hasLoadedRef.current = true
      setLoading(false)
    }
  }, [fetchAndEnrich, userId, channelId])

  // fetchMessages ja gestiona internament el cas !channelId (apaga el loading).
  useEffect(() => { fetchMessages() }, [channelId, fetchMessages])

  // Realtime: INSERT propaga missatges nous, DELETE propaga eliminacions a tots els membres
  useEffect(() => {
    if (!channelId) return
    const channel = supabase.channel(`ch-view-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'channel_messages',
        filter: `channel_id=eq.${channelId}`,
      }, () => fetchMessages())
      .on('postgres_changes', {
        // Sense filter: DELETE events no suporten filtres sense REPLICA IDENTITY FULL
        // Es filtra per id al callback — si el missatge no és al canal actiu, no passa res
        event: 'DELETE', schema: 'public', table: 'channel_messages',
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [channelId, fetchMessages])

  usePolling(fetchMessages, 30000, !!channelId)

  // Hard delete: verifica via .select() que la DELETE ha afectat alguna fila
  // (si RLS bloqueja, no llença error però retorna data buit)
  const deleteMessage = useCallback(async (msgId) => {
    const { data, error } = await supabase
      .from('channel_messages')
      .delete()
      .eq('id', msgId)
      .select()
    if (error) { console.error('[CH delete] error:', error); alert('Error al eliminar: ' + error.message); return false }
    if (!data?.length) {
      console.warn('[CH delete] RLS bloqueja la DELETE — cap fila eliminada')
      alert('No se puede eliminar este mensaje (permisos)')
      return false
    }
    setMessages(prev => prev.filter(m => m.id !== msgId))
    return true
  }, [])

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

    try {
      const { error } = await supabase.from('channel_messages').insert({
        channel_id: channelId,
        user_id: sendUserId,
        content: content.trim(),
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      const enriched = await fetchAndEnrich()
      if (enriched) setMessages(enriched)
    } catch {
      // Reverteix el missatge optimista si el servidor rebutja l'insert
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    }
  }

  return { messages, loading, sendMessage, recordView, deleteMessage }
}
