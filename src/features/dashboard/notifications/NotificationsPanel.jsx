import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { insertNotification } from './useNotifications'
import { useFollow } from '../social/hooks/useFollow'

function timeAgo(ts) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

function notifText(n) {
  switch (n.type) {
    case 'like':         return `le dio like a tu pick${n.preview ? ` · ${n.preview}` : ''}.`
    case 'comment':      return `comentó: "${n.preview}".`
    case 'follow':       return 'empezó a seguirte.'
    case 'channel_join': return 'se unió a tu canal.'
    case 'dm':           return 'te envió un mensaje.'
    default:             return (n.preview || 'Nueva notificación') + '.'
  }
}

function Avatar({ profile, size = 36 }) {
  const initial = (profile?.username || '?')[0].toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  )
}

function NotifItem({ n, profile, onViewProfile, onViewPost, currentUser, followedSet, onFollowed, isFollowingFn }) {
  const isLike = n.type === 'like'
  const isFollow = n.type === 'follow'
  const alreadyFollowed = isFollowingFn(n.from_user_id) || followedSet.has(n.from_user_id)
  const displayName = profile?.username || n.from_username

  const handleFollow = async (e) => {
    e.stopPropagation()
    if (!currentUser?.id || alreadyFollowed) return
    await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: n.from_user_id })
    await insertNotification({
      userId: n.from_user_id,
      type: 'follow',
      fromUserId: currentUser.id,
      fromUsername: currentUser.username || currentUser.name || 'alguien',
    })
    onFollowed(n.from_user_id)
  }

  const handleRowClick = () => {
    if (isLike && n.message_id) onViewPost?.(n.message_id)
  }

  return (
    <div onClick={handleRowClick}
      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '0.5px solid var(--color-border)', cursor: isLike && n.message_id ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => { if (isLike && n.message_id) e.currentTarget.style.background = 'var(--color-bg-soft)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(n.from_user_id) }} style={{ cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}>
        <Avatar profile={profile} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text)' }}>
          <span
            onClick={(e) => { e.stopPropagation(); onViewProfile?.(n.from_user_id) }}
            style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--color-text)', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--color-text)' }}
            onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}>
            {displayName}
          </span>{' '}
          <span style={{ color: 'var(--color-text-muted)' }}>{notifText(n)}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{timeAgo(n.created_at)}</div>
        {isFollow && (
          <button onClick={handleFollow} disabled={alreadyFollowed}
            style={{ marginTop: '8px', padding: '5px 14px', borderRadius: 'var(--radius-md)', border: alreadyFollowed ? '0.5px solid var(--color-primary-border)' : '0.5px solid var(--color-primary-border)', background: alreadyFollowed ? 'var(--color-primary-light)' : 'var(--color-primary-light)', color: alreadyFollowed ? 'var(--color-primary)' : 'var(--color-primary)', cursor: alreadyFollowed ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            {alreadyFollowed ? '👥 Amigos ✓' : 'Seguir también'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPanel({ notifications, onClose, onViewProfile, onViewPost, currentUser }) {
  const { isFollowing } = useFollow(currentUser?.id)
  const [followedSet, setFollowedSet] = useState(new Set())
  const [profileMap, setProfileMap] = useState({})

  useEffect(() => {
    const ids = [...new Set(notifications.map(n => n.from_user_id).filter(Boolean))]
    if (!ids.length) return
    supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      .then(({ data }) => {
        if (data) setProfileMap(Object.fromEntries(data.map(p => [p.id, p])))
      })
  }, [notifications])

  const handleFollowed = (userId) => setFollowedSet(prev => new Set([...prev, userId]))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '360px', maxWidth: '90vw', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 99, overflow: 'hidden', maxHeight: '480px', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Notificaciones</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
              <div style={{ fontSize: '13px' }}>Sin notificaciones aún</div>
            </div>
          ) : notifications.map(n => (
            <NotifItem
              key={n.id}
              n={n}
              profile={profileMap[n.from_user_id]}
              onViewProfile={onViewProfile}
              onViewPost={onViewPost}
              currentUser={currentUser}
              followedSet={followedSet}
              onFollowed={handleFollowed}
              isFollowingFn={isFollowing}
            />
          ))}
        </div>
      </motion.div>
    </>
  )
}
