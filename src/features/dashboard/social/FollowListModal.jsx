import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { insertNotification } from '../notifications/useNotifications'

export default function FollowListModal({ type, profileUserId, currentUser, onClose, onViewProfile, onStartDM }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [followingSet, setFollowingSet] = useState(new Set())

  useEffect(() => {
    fetchList()
  }, [type, profileUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchList = async () => {
    setLoading(true)
    try {
      let userIds = []
      if (type === 'followers') {
        const { data } = await supabase.from('follows').select('follower_id').eq('following_id', profileUserId)
        userIds = (data || []).map(r => r.follower_id)
      } else {
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', profileUserId)
        userIds = (data || []).map(r => r.following_id)
      }

      if (!userIds.length) { setUsers([]); setLoading(false); return }

      const [{ data: profiles }, { data: myFollows }] = await Promise.all([
        supabase.from('profiles').select('id, username, name, avatar_url').in('id', userIds),
        currentUser?.id
          ? supabase.from('follows').select('following_id').eq('follower_id', currentUser.id).in('following_id', userIds)
          : Promise.resolve({ data: [] }),
      ])

      setUsers(profiles || [])
      setFollowingSet(new Set((myFollows || []).map(f => f.following_id)))
    } finally {
      setLoading(false)
    }
  }

  const toggleFollow = async (userId, username) => {
    const following = followingSet.has(userId)
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId)
      setFollowingSet(prev => { const n = new Set(prev); n.delete(userId); return n })
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: userId })
      setFollowingSet(prev => new Set([...prev, userId]))
      await insertNotification({ userId, type: 'follow', fromUserId: currentUser.id, fromUsername: currentUser.username || currentUser.name || 'alguien' })
    }
  }

  const title = type === 'followers' ? 'Seguidores' : 'Siguiendo'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '400px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>⏳ Cargando...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Sin {title.toLowerCase()} todavía</div>
          ) : users.map((u, i) => {
            const isFollowingUser = followingSet.has(u.id)
            const isOwn = u.id === currentUser?.id
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: i < users.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
                <div onClick={() => { onViewProfile?.(u.id); onClose() }}
                  style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }}>
                  {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.username || '?')[0].toUpperCase()}
                </div>
                <div onClick={() => { onViewProfile?.(u.id); onClose() }} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.username}</div>
                </div>
                {!isOwn && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleFollow(u.id, u.username)}
                      style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', border: isFollowingUser ? '0.5px solid var(--color-border)' : 'none', background: isFollowingUser ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: isFollowingUser ? 'var(--color-text-muted)' : '#010906', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                      {isFollowingUser ? 'Siguiendo' : '+ Seguir'}
                    </button>
                    {onStartDM && (
                      <button onClick={() => { onStartDM(u.id); onClose() }}
                        style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                        💬
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
