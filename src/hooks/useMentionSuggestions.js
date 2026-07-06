import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Font de suggeriments per a les mencions @. Prioritza:
//  1) Tu mateix.
//  2) La gent que segueixes (proxy de "els més comuns per a tu").
//  3) Cerca oberta per username si cal completar.
export function useMentionSuggestions(currentUser) {
  const poolRef = useRef([]) // [{ id, username, avatar_url, is_verified, _self? }]

  useEffect(() => {
    if (!currentUser?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: following } = await supabase
          .from('follows').select('following_id').eq('follower_id', currentUser.id).limit(200)
        const ids = (following || []).map(f => f.following_id)
        let profiles = []
        if (ids.length) {
          const { data } = await supabase
            .from('profiles').select('id, username, avatar_url, is_verified').in('id', ids).limit(200)
          profiles = (data || [])
        }
        if (cancelled) return
        const self = { id: currentUser.id, username: currentUser.username, avatar_url: currentUser.avatar_url, is_verified: currentUser.is_verified, _self: true }
        poolRef.current = [self, ...profiles]
      } catch {
        // pool buit: la cerca oberta seguirà funcionant
      }
    })()
    return () => { cancelled = true }
  }, [currentUser?.id, currentUser?.username, currentUser?.avatar_url])

  // Retorna fins a 6 suggeriments per a una query (sense @).
  const search = useCallback(async (q) => {
    const query = (q || '').toLowerCase()
    const pool = poolRef.current.filter(p => p.username)
    let out = query === '' ? [...pool] : pool.filter(p => p.username.toLowerCase().includes(query))
    out = out.slice(0, 6)

    // Si el pool no omple i hi ha query, completa amb cerca oberta per username.
    if (query.length >= 1 && out.length < 6) {
      try {
        const { data } = await supabase
          .from('profiles').select('id, username, avatar_url, is_verified')
          .ilike('username', `${q}%`).neq('id', currentUser?.id || '').limit(8)
        const seen = new Set(out.map(p => p.id))
        for (const p of (data || [])) {
          if (out.length >= 6) break
          if (!seen.has(p.id)) { out.push(p); seen.add(p.id) }
        }
      } catch {
        // ignore
      }
    }
    return out.slice(0, 6)
  }, [currentUser?.id])

  return { search }
}
