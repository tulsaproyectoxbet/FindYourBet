import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'

// Carpetes de xats (DMs), sincronitzades a Supabase (taula user_preferences, JSON per
// usuari). Se segueixen a tots els dispositius.
// - Sempre existeix "General" (id 'general'), no es pot esborrar.
// - Fins a 5 carpetes secundàries.
// - Cada conversa pertany a UNA carpeta (General per defecte).
// - Límits anti-spam: màxim de carpetes + cooldown entre crear/esborrar.

export const GENERAL_FOLDER = { id: 'general', name: 'General' }
export const MAX_SECONDARY_FOLDERS = 5
const MUTATION_COOLDOWN = 2500 // ms entre crear/esborrar carpetes
const MAX_NAME_LEN = 20

export function useDMFolders(userId) {
  const [secondary, setSecondary] = useState([]) // [{id,name}]
  const [assignments, setAssignments] = useState({}) // {convId: folderId}
  const [mutedFolders, setMutedFolders] = useState([]) // [folderId]
  const [activeFolder, setActiveFolder] = useState('general')
  const prefsRef = useRef({}) // blob complet de user_preferences.data (no clobrar altres claus)
  const lastMutationRef = useRef(0)

  // Càrrega inicial des de Supabase.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('user_preferences').select('data').eq('user_id', userId).maybeSingle()
        const d = (data && data.data) || {}
        if (cancelled) return
        prefsRef.current = d
        setSecondary(Array.isArray(d.dmFolders) ? d.dmFolders : [])
        setAssignments(d.dmFolderAssign && typeof d.dmFolderAssign === 'object' ? d.dmFolderAssign : {})
        setMutedFolders(Array.isArray(d.dmFolderMuted) ? d.dmFolderMuted : [])
      } catch {
        // silenciós: si falla, es queda amb General i prou
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  // Desa (merge amb la resta de preferències) — silenciós i tolerant a errors.
  const save = useCallback((patch) => {
    const next = { ...prefsRef.current, ...patch }
    prefsRef.current = next
    if (!userId) return
    supabase.from('user_preferences')
      .upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
      .then(() => {}, () => {})
  }, [userId])

  const folders = [GENERAL_FOLDER, ...secondary]

  const folderOf = useCallback((convId) => {
    const f = assignments[convId]
    if (!f || f === 'general') return 'general'
    return secondary.some(s => s.id === f) ? f : 'general'
  }, [assignments, secondary])

  const createFolder = (rawName) => {
    const name = (rawName || '').trim().slice(0, MAX_NAME_LEN)
    if (!name) return { error: 'Escribe un nombre para la carpeta.' }
    if (secondary.length >= MAX_SECONDARY_FOLDERS) return { error: `Máximo ${MAX_SECONDARY_FOLDERS} carpetas.` }
    if (Date.now() - lastMutationRef.current < MUTATION_COOLDOWN) return { error: 'Espera un momento antes de crear otra carpeta.' }
    if (folders.some(f => f.name.toLowerCase() === name.toLowerCase())) return { error: 'Ya tienes una carpeta con ese nombre.' }
    lastMutationRef.current = Date.now()
    const id = `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const next = [...secondary, { id, name }]
    setSecondary(next); save({ dmFolders: next })
    return { id }
  }

  const deleteFolder = (folderId) => {
    if (folderId === 'general') return { error: 'La carpeta General no se puede eliminar.', convIds: [] }
    if (Date.now() - lastMutationRef.current < MUTATION_COOLDOWN) return { error: 'Espera un momento.', convIds: [] }
    lastMutationRef.current = Date.now()
    const convIds = Object.keys(assignments).filter(cid => assignments[cid] === folderId)
    const nextAssign = { ...assignments }
    convIds.forEach(cid => { delete nextAssign[cid] })
    const nextSecondary = secondary.filter(s => s.id !== folderId)
    const nextMuted = mutedFolders.filter(m => m !== folderId)
    setAssignments(nextAssign); setSecondary(nextSecondary); setMutedFolders(nextMuted)
    save({ dmFolderAssign: nextAssign, dmFolders: nextSecondary, dmFolderMuted: nextMuted })
    if (activeFolder === folderId) setActiveFolder('general')
    return { convIds }
  }

  const assignConversation = (convId, folderId) => {
    const next = { ...assignments }
    if (!folderId || folderId === 'general') delete next[convId]
    else next[convId] = folderId
    setAssignments(next); save({ dmFolderAssign: next })
  }

  const forgetConversation = (convId) => {
    if (assignments[convId] === undefined) return
    const next = { ...assignments }
    delete next[convId]
    setAssignments(next); save({ dmFolderAssign: next })
  }

  const isFolderMuted = useCallback((folderId) => mutedFolders.includes(folderId), [mutedFolders])
  const toggleFolderMuted = (folderId) => {
    const muted = mutedFolders.includes(folderId)
    const next = muted ? mutedFolders.filter(m => m !== folderId) : [...mutedFolders, folderId]
    setMutedFolders(next); save({ dmFolderMuted: next })
    return !muted
  }

  return {
    folders, secondary, activeFolder, setActiveFolder,
    folderOf, createFolder, deleteFolder, assignConversation, forgetConversation,
    isFolderMuted, toggleFolderMuted,
    MAX_SECONDARY_FOLDERS,
  }
}
