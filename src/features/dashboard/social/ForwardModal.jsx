import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import AppIcon from '../../../components/ui/AppIcon'

// rawContent: when provided, sends this exact string (no FWD prefix) — used for sharing channels/profiles
export default function ForwardModal({ content, fromChannelName, currentUser, onClose, rawContent = null }) {
  const [tab, setTab] = useState('dm')
  const [conversations, setConversations] = useState([])
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [sentSet, setSentSet] = useState(new Set())
  const [sending, setSending] = useState(null)

  useEffect(() => { fetchTargets() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTargets = async () => {
    const [{ data: allConvs }, { data: chans }] = await Promise.all([
      supabase.from('dm_conversations')
        .select('id, user1_id, user2_id, user1_hidden_at, user2_hidden_at')
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .limit(50),
      supabase.from('channels')
        .select('id, name, is_private, avatar_url')
        .eq('owner_id', currentUser.id)
        .is('deleted_at', null)
        .limit(20),
    ])

    // Exclou converses que l'usuari ha esborrat (soft-delete) — no han d'aparèixer com a destí
    const convs = (allConvs || []).filter(c => {
      const hiddenAt = c.user1_id === currentUser.id ? c.user1_hidden_at : c.user2_hidden_at
      return !hiddenAt
    })

    if (convs?.length) {
      const otherIds = convs.map(c => c.user1_id === currentUser.id ? c.user2_id : c.user1_id)
      const { data: profiles } = await supabase.from('profiles')
        .select('id, username, name, avatar_url')
        .in('id', otherIds)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      setConversations(convs.map(c => {
        const otherId = c.user1_id === currentUser.id ? c.user2_id : c.user1_id
        return { ...c, otherId, profile: profileMap[otherId] || null }
      }))
    }
    setChannels(chans || [])
    setLoading(false)
  }

  const outContent = rawContent
    ? rawContent
    : fromChannelName ? `[FWD:${fromChannelName}]:${content}` : `[FWD]:${content}`

  const forwardToDM = async (conv) => {
    if (sentSet.has(conv.id) || sending) return
    setSending(conv.id)
    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conv.id,
      sender_id: currentUser.id,
      content: outContent,
    })
    if (!error) setSentSet(prev => new Set([...prev, conv.id]))
    setSending(null)
  }

  const forwardToChannel = async (channel) => {
    if (sentSet.has(channel.id) || sending) return
    setSending(channel.id)
    const { error } = await supabase.from('channel_messages').insert({
      channel_id: channel.id,
      user_id: currentUser.id,
      content: outContent,
    })
    if (!error) setSentSet(prev => new Set([...prev, channel.id]))
    setSending(null)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '540px', maxHeight: '72vh', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>{rawContent ? <><AppIcon name="send" size={15} /> Compartir</> : <><AppIcon name="arrowOut" size={15} /> Reenviar mensaje</>}</div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: '4px 6px' }}>
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          {[['dm', <><AppIcon name="social" size={13} /> Mensaje</>], ['canal', <><AppIcon name="canales" size={13} /> Mi canal</>]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: tab === t ? 700 : 500, fontSize: '13px', color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: `2px solid ${tab === t ? 'var(--color-primary)' : 'transparent'}`, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Cargando...</div>
          ) : tab === 'dm' ? (
            conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                <div style={{ marginBottom: '8px' }}><AppIcon name="social" size={28} /></div>
                No tienes conversaciones abiertas
              </div>
            ) : conversations.map(conv => {
              const sent = sentSet.has(conv.id)
              const isSending = sending === conv.id
              const username = conv.profile?.username || conv.otherId.slice(0, 8)
              return (
                <button key={conv.id} onClick={() => forwardToDM(conv)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 20px', background: sent ? 'var(--color-primary-light)' : 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: sent ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', boxSizing: 'border-box', transition: 'background 0.15s' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, position: 'relative' }}>
                    {username[0]?.toUpperCase()}
                    {conv.profile?.avatar_url && (
                      <img src={conv.profile.avatar_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: sent ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                    {isSending ? <AppIcon name="loading" size={14} /> : sent ? <><AppIcon name="check" size={12} /> Enviado</> : 'Enviar →'}
                  </div>
                </button>
              )
            })
          ) : (
            channels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                <div style={{ marginBottom: '8px' }}><AppIcon name="canales" size={28} /></div>
                No tienes canales propios
              </div>
            ) : channels.map(ch => {
              const sent = sentSet.has(ch.id)
              const isSending = sending === ch.id
              return (
                <button key={ch.id} onClick={() => forwardToChannel(ch)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 20px', background: sent ? 'var(--color-primary-light)' : 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: sent ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', boxSizing: 'border-box', transition: 'background 0.15s' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, position: 'relative' }}>
                    {ch.name[0]?.toUpperCase()}
                    {ch.avatar_url && (
                      <img src={ch.avatar_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}><AppIcon name={ch.is_private ? 'lock' : 'globe'} size={10} />{ch.is_private ? 'Privado' : 'Público'}</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: sent ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                    {isSending ? <AppIcon name="loading" size={14} /> : sent ? <><AppIcon name="check" size={12} /> Enviado</> : 'Enviar →'}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
