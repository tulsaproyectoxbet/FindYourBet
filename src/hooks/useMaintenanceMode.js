import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { isAdminUserId } from '../lib/adminUsers'
import { usePolling } from './usePolling'

export function useMaintenanceMode(userId) {
  const [state, setState] = useState({
    isActive: false,
    message: '',
    estimatedDuration: '',
    scheduledAt: null,
  })
  const hasLoadedRef = useRef(false)
  const isAdmin = isAdminUserId(userId)

  const fetchStatus = async () => {
    if (isAdmin) return
    const safetyTimer = setTimeout(() => setState(s => ({ ...s })), 10000)
    try {
      const { data } = await supabase
        .from('maintenance_mode')
        .select('is_active, message, estimated_duration, scheduled_at')
        .eq('id', 1)
        .single()
      if (!data) return
      // L'activació programada la gestiona el client: si scheduled_at ha passat, tractem com actiu
      const scheduledTriggered = data.scheduled_at && new Date(data.scheduled_at) <= new Date()
      setState({
        isActive: data.is_active || scheduledTriggered,
        message: data.message || '',
        estimatedDuration: data.estimated_duration || '',
        scheduledAt: data.scheduled_at,
      })
    } catch { /* silenciós */ }
    finally {
      clearTimeout(safetyTimer)
      hasLoadedRef.current = true
    }
  }

  // Fetch inicial
  useEffect(() => { fetchStatus() }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling cada 30s
  usePolling(fetchStatus, 30000, !isAdmin)

  if (isAdmin) return { isActive: false, message: '', estimatedDuration: '', scheduledAt: null }
  return state
}
