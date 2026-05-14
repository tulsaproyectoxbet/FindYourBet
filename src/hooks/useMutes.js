import { useState, useCallback } from 'react'

const KEY = 'fyb_mutes'

export const MUTE_DURATIONS = [
  { label: 'Silenciar', ms: null },
  { label: '1 hora', ms: 3_600_000 },
  { label: '3 horas', ms: 10_800_000 },
  { label: '8 horas', ms: 28_800_000 },
  { label: '1 día', ms: 86_400_000 },
  { label: '2 días', ms: 172_800_000 },
  { label: '7 días', ms: 604_800_000 },
  { label: '30 días', ms: 2_592_000_000 },
]

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') }
  catch { return {} }
}
function write(m) { localStorage.setItem(KEY, JSON.stringify(m)) }

function check(key) {
  const m = read()
  const e = m[key]
  if (!e) return false
  if (e === 'forever') return true
  if (Date.now() < e) return true
  delete m[key]; write(m)
  return false
}

function label(key) {
  const e = read()[key]
  if (!e || (e !== 'forever' && Date.now() >= e)) return null
  if (e === 'forever') return '∞'
  const rem = e - Date.now()
  const d = Math.floor(rem / 86_400_000)
  const h = Math.floor(rem / 3_600_000)
  const min = Math.floor(rem / 60_000)
  if (d >= 1) return `${d}d`
  if (h >= 1) return `${h}h`
  return `${min}m`
}

export function useMutes() {
  const [, tick] = useState(0)
  const refresh = () => tick(n => n + 1)

  const mute = useCallback((key, ms) => {
    const m = read()
    m[key] = ms === null ? 'forever' : Date.now() + ms
    write(m); refresh()
  }, [])

  const unmute = useCallback((key) => {
    const m = read()
    delete m[key]; write(m); refresh()
  }, [])

  const isMuted = useCallback((key) => check(key), [])
  const muteLabel = useCallback((key) => label(key), [])

  return { mute, unmute, isMuted, muteLabel }
}
