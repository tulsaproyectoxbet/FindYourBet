import { useEffect, useRef } from 'react'

// Polling intel·ligent: pausa quan el navegador no és visible.
// Quan torna la visibilitat, NO dispara la fetch immediatament — esperem fins al
// pròxim interval. Disparar immediatament feia que totes les pollings de l'app
// (notifs + DMs + canals + feed) es disparessin alhora i saturessin Supabase
// quan l'usuari tornava a la pestanya, causant "Cargando" intermitent.
export function usePolling(fn, intervalMs, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return

    let intervalId = null

    const start = () => {
      if (intervalId) return
      intervalId = setInterval(() => fnRef.current(), intervalMs)
    }

    const stop = () => {
      if (!intervalId) return
      clearInterval(intervalId)
      intervalId = null
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        start() // sense fire immediat — evita burst de requests
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}
