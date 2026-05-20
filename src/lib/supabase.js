import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://slfgvgvguwavvbkpsngf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZmd2Z3ZndXdhdnZia3BzbmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzMwNzUsImV4cCI6MjA5MzE0OTA3NX0.QgkenXcDQb0FkXkIrZ6YaePPzq4GicM24-Uaa1kuR5M'

// Timeout sense AbortController (que corromp el DNS cache del navegador en abortar).
// Si la petició no respon en 15s, fem reject perquè el codi pugui continuar.
// La petició real segueix viva al navegador fins que tanqui la connexió per si mateixa.
function fetchWithTimeout(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Supabase request timeout')), 15000)
    fetch(url, options).then(
      response => { clearTimeout(timer); resolve(response) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

// Singleton: evita que Vite HMR creï múltiples clients competint per la sessió de localStorage.
// `lock` substitueix el navigator.locks intern que provoca penjades de signInWithPassword
// quan hi ha pestanyes anteriors o sessions interrompudes que mai van alliberar el lock.
if (!globalThis.__supabase_client__) {
  globalThis.__supabase_client__ = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
    global: {
      fetch: fetchWithTimeout,
    },
  })
}

export const supabase = globalThis.__supabase_client__