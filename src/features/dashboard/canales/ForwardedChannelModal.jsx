import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

// S'auto-navega si el canal és accessible. Només mostra UI per als casos d'error.
export default function ForwardedChannelModal({ channelName, currentUser, onNavigateToChannel, onClose }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'private' | 'notfound'

  useEffect(() => {
    const load = async () => {
      const { data: channel } = await supabase
        .from('channels')
        .select('id, name, description, is_private, channel_type, avatar_url, owner_id, invite_code')
        .eq('name', channelName)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (!channel) { setStatus('notfound'); return }

      if (channel.is_private) {
        // Comprova si l'usuari és membre
        const { data: membership } = await supabase
          .from('channel_members').select('id')
          .eq('channel_id', channel.id).eq('user_id', currentUser.id)
          .maybeSingle()
        if (!membership) { setStatus('private'); return }
      }

      // Accessible: navega directament i tanca el modal sense mostrar res
      onNavigateToChannel?.(channel)
      onClose()
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mentre carrega, backdrop transparent (invisible)
  if (status === 'loading') return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        style={{ position: 'fixed', inset: 0, zIndex: 401, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', pointerEvents: 'none' }}
      >
        <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px 28px', maxWidth: '320px', width: '100%', pointerEvents: 'auto', textAlign: 'center' }}>
          {status === 'notfound' && (
            <>
              <div style={{ marginBottom: '10px' }}><AppIcon name="mail" size={30} /></div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>Canal no disponible</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Este canal ya no existe o fue eliminado.</div>
            </>
          )}
          {status === 'private' && (
            <>
              <div style={{ marginBottom: '10px' }}><AppIcon name="lock" size={30} /></div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>Canal privado</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>No puedes acceder. El canal es privado.</div>
            </>
          )}
          <button onClick={onClose}
            style={{ padding: '8px 22px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
            Cerrar
          </button>
        </div>
      </motion.div>
    </>
  )
}
