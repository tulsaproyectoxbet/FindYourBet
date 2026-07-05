import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://slfgvgvguwavvbkpsngf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZmd2Z3ZndXdhdnZia3BzbmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzMwNzUsImV4cCI6MjA5MzE0OTA3NX0.QgkenXcDQb0FkXkIrZ6YaePPzq4GicM24-Uaa1kuR5M'

// Timeout sense AbortController (que corromp el DNS cache del navegador en abortar).
// La petició real segueix viva al navegador fins que tanqui la connexió per si mateixa.
//
// 15s (abans 8s): el free tier de Supabase té latència variable i les pantalles
// pesades (Ranking amb milers d'apostes, Tipsters/Perfil amb 7 queries en paral·lel)
// poden passar de 8s en un mal moment. Amb 8s es morien a mitges → el Promise.all
// rebutjava sencer → catch → dades buides → "Cargando" que mai carrega. Les safety
// timers dels components (8-10s) ja treuen l'spinner, així que 15s NO deixa l'usuari
// mirant un spinner: només dona marge perquè la petició acabi de veritat.
const REQUEST_TIMEOUT_MS = 15000

function fetchOnce(url, options) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Supabase request timeout')), REQUEST_TIMEOUT_MS)
    fetch(url, options).then(
      response => { clearTimeout(timer); resolve(response) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

function fetchWithTimeout(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  // Només reintentem lectures (GET/HEAD): són idempotents. Reintentar POST/PATCH/DELETE
  // podria duplicar un insert o repetir una acció. Un sol retry absorbeix els timeouts
  // transitoris que abans deixaven una pestanya sencera sense dades.
  const idempotent = method === 'GET' || method === 'HEAD'
  if (!idempotent) return fetchOnce(url, options)
  return fetchOnce(url, options).catch(() => fetchOnce(url, options))
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