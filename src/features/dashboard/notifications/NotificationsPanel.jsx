import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { insertNotification } from './useNotifications'
import { useFollow } from '../social/hooks/useFollow'
import Username from '../../../components/ui/Username'

const TABS = [
  { id: 'todos',        label: 'Todos' },
  { id: 'seguidores',   label: 'Seguidores' },
  { id: 'likes',        label: 'Likes' },
  { id: 'comentarios',  label: 'Comentarios' },
]

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
    case 'like':            return 'le dio like a tu pick.'
    case 'comment':         return `comentó tu pick.`
    case 'follow':          return 'empezó a seguirte.'
    case 'channel_join':    return 'se unió a tu canal.'
    case 'dm':              return 'te envió un mensaje.'
    case 'channel_message': return `envió un mensaje${n.preview ? `: "${n.preview}"` : ' en un canal'}.`
    default:                return (n.preview || 'Nueva notificación') + '.'
  }
}

// Deduplicació: per cada (usuari, tipus) només queda la notificació més recent
function deduplicate(notifications) {
  const seen = new Map()
  for (const n of notifications) {
    const key = `${n.from_user_id}_${n.type}`
    if (!seen.has(key)) seen.set(key, n) // les notifs ja venen per data desc
  }
  return [...seen.values()]
}

function filterByTab(notifications, tab) {
  if (tab === 'todos')       return notifications
  if (tab === 'seguidores')  return notifications.filter(n => n.type === 'follow')
  if (tab === 'likes')       return notifications.filter(n => n.type === 'like')
  if (tab === 'comentarios') return notifications.filter(n => n.type === 'comment')
  return notifications
}

function tabCount(notifications, tab) {
  const unread = notifications.filter(n => !n.read_at)
  return deduplicate(filterByTab(unread, tab)).length
}

function Avatar({ profile, size = 36 }) {
  const [imgError, setImgError] = useState(false)
  const initial = (profile?.username || '?')[0].toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.avatar_url && !imgError
        ? <img src={profile.avatar_url} alt="" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  )
}

// Preview petit del post per likes i comentaris
function PostPreview({ text, onClick }) {
  if (!text) return null
  return (
    <div onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{ marginTop: '8px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 10px', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'var(--color-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {text}
      </div>
      {onClick && (
        <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '4px' }}>
          Ver pick →
        </div>
      )}
    </div>
  )
}

function NotifItem({ n, profile, onViewProfile, onViewPost, currentUser, followedSet, onFollowed, isFollowingFn }) {
  const isFollow  = n.type === 'follow'
  const isLike    = n.type === 'like'
  const isComment = n.type === 'comment'
  const hasPost   = (isLike || isComment) && n.message_id
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

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid var(--color-border)' }}>

      {/* Avatar */}
      <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(n.from_user_id) }} style={{ cursor: 'pointer', flexShrink: 0 }}>
        <Avatar profile={profile} />
      </div>

      {/* Contingut */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text)' }}>
          <span
            onClick={(e) => { e.stopPropagation(); onViewProfile?.(n.from_user_id) }}
            style={{ fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            <Username username={displayName} isVerified={profile?.is_verified} size="sm" />
          </span>{' '}
          <span style={{ color: 'var(--color-text-muted)' }}>{notifText(n)}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{timeAgo(n.created_at)}</div>

        {/* Preview del post per likes i comentaris */}
        {hasPost && (
          <PostPreview text={n.preview} onClick={() => onViewPost?.(n.message_id)} />
        )}
      </div>

      {/* Botó seguir — a la dreta */}
      {isFollow && (
        <button onClick={handleFollow} disabled={alreadyFollowed}
          style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-primary-border)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', cursor: alreadyFollowed ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
          {alreadyFollowed ? '👥 Amigos ✓' : 'Seguir también'}
        </button>
      )}
    </div>
  )
}

export default function NotificationsPanel({ notifications, onClose, onViewProfile, onViewPost, currentUser, onMarkAllRead }) {
  const { isFollowing } = useFollow(currentUser?.id)
  const [followedSet, setFollowedSet] = useState(new Set())
  const [profileMap, setProfileMap] = useState({})
  const [activeTab, setActiveTab] = useState('todos')

  useEffect(() => {
    const ids = [...new Set(notifications.map(n => n.from_user_id).filter(Boolean))]
    if (!ids.length) return
    supabase.from('profiles').select('id, username, avatar_url, is_verified').in('id', ids)
      .then(({ data }) => {
        if (data) setProfileMap(Object.fromEntries(data.map(p => [p.id, p])))
      })
  }, [notifications])

  const handleFollowed = (userId) => setFollowedSet(prev => new Set([...prev, userId]))

  // Canals i DMs ja tenen els seus badges a la sidebar — no es mostren aquí
  const EXCLUDED = ['channel_message', 'dm']
  const filtered = notifications.filter(n => !EXCLUDED.includes(n.type))
  const visible = deduplicate(filterByTab(filtered, activeTab))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '380px', maxWidth: '92vw', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 99, overflow: 'hidden', maxHeight: '520px', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px' }}>Notificaciones</div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '0.5px solid var(--color-border)', paddingBottom: '0' }}>
            {TABS.map(t => {
              const count = t.id !== 'todos' ? tabCount(filtered, t.id) : null
              const isActive = activeTab === t.id
              return (
                <button key={t.id} onClick={() => { setActiveTab(t.id); onMarkAllRead?.() }}
                  style={{ padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-1px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {t.label}
                  {count > 0 && (
                    <span style={{ background: 'var(--color-error)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius-full)', lineHeight: 1.5 }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Llista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {activeTab === 'seguidores' ? '👤' : activeTab === 'likes' ? '❤️' : activeTab === 'comentarios' ? '💬' : '🔔'}
              </div>
              <div style={{ fontSize: '13px' }}>Sin notificaciones aún</div>
            </div>
          ) : visible.map(n => (
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
