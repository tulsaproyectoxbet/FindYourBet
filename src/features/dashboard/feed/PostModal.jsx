import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { insertNotification } from '../notifications/useNotifications'
import ForwardModal from '../social/ForwardModal'

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

const STATUS_CFG = {
  won:     { label: 'Ganada',    color: 'var(--color-primary)',    bg: 'var(--color-primary-light)',  border: 'var(--color-primary-border)' },
  lost:    { label: 'Perdida',   color: 'var(--color-error)',      bg: 'var(--color-error-light)',    border: 'var(--color-error-border)' },
  pending: { label: 'Pendiente', color: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)',        border: 'var(--color-border)' },
}

function CommentItem({ comment, likeInfo, onLike, onReply, isReply, reported, onReport }) {
  const likeCount = likeInfo?.count || 0
  const hasLiked = likeInfo?.hasLiked || false
  const avatarSize = isReply ? '24px' : '32px'
  return (
    <div style={{ display: 'flex', gap: '9px' }}>
      <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isReply ? '9px' : '12px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
        {comment.profile?.avatar_url
          ? <img src={comment.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (comment.profile?.username || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
          <span style={{ fontSize: isReply ? '12px' : '13px', fontWeight: 700 }}>{comment.profile?.username || 'usuario'}</span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{timeAgo(comment.created_at)}</span>
        </div>
        <div style={{ fontSize: isReply ? '12px' : '13px', lineHeight: 1.5, color: 'var(--color-text)', marginBottom: '5px' }}>{comment.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onLike}
            style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: hasLiked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontWeight: hasLiked ? 700 : 400, borderRadius: 'var(--radius-sm)' }}>
            <span>{hasLiked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span style={{ marginLeft: '2px' }}>{likeCount}</span>}
          </motion.button>
          {!isReply && onReply && (
            <button onClick={onReply}
              style={{ padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-sm)' }}>
              ↩ Responder
            </button>
          )}
          <button onClick={onReport}
            style={{ padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-sm)', color: reported ? 'var(--color-primary)' : 'var(--color-text-muted)', opacity: reported ? 1 : 0.45, transition: 'all 0.15s' }}>
            {reported ? '✓ Rep.' : '🚩'}
          </button>
        </div>
      </div>
    </div>
  )
}

async function findMessageIdByBet(betId) {
  if (!betId) return null
  const { data } = await supabase
    .from('channel_messages')
    .select('id')
    .like('content', `%"id":"${betId}"%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id || null
}

async function fetchPostData(messageId, currentUserId) {
  if (!messageId) return null
  const { data: msg } = await supabase
    .from('channel_messages')
    .select('*')
    .eq('id', messageId)
    .single()
  if (!msg) return null

  let bet = null
  try { bet = JSON.parse(msg.content.replace('[BET]:', '')) } catch { return null }
  if (!bet) return null

  const [
    { data: channel },
    { data: posterProfile },
    { data: likes },
    { data: comments },
    { data: myLike },
    { data: membership },
    { data: betRow },
  ] = await Promise.all([
    supabase.from('channels').select('id, name, invite_code, is_private, deleted_at, owner_id').eq('id', msg.channel_id).single(),
    supabase.from('profiles').select('id, username, avatar_url').eq('id', msg.user_id).single(),
    supabase.from('post_likes').select('user_id').eq('message_id', messageId),
    supabase.from('post_comments').select('id, user_id, content, created_at, parent_id').eq('message_id', messageId).order('created_at', { ascending: true }),
    supabase.from('post_likes').select('id').eq('message_id', messageId).eq('user_id', currentUserId).maybeSingle(),
    supabase.from('channel_members').select('id').eq('channel_id', msg.channel_id).eq('user_id', currentUserId).maybeSingle(),
    bet.id ? supabase.from('bets').select('status, was_private').eq('id', bet.id).single() : Promise.resolve({ data: null }),
  ])

  const commentUserIds = [...new Set((comments || []).map(c => c.user_id))]
  let commentProfiles = []
  if (commentUserIds.length) {
    const { data: cp } = await supabase.from('profiles').select('id, username, avatar_url').in('id', commentUserIds)
    commentProfiles = cp || []
  }
  const commentProfileMap = Object.fromEntries(commentProfiles.map(p => [p.id, p]))

  // Likes de comentaris
  const commentIds = (comments || []).map(c => c.id).filter(Boolean)
  let commentLikesData = []
  if (commentIds.length) {
    try {
      const { data: cl } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      commentLikesData = cl || []
    } catch { /* taula comment_likes pot no existir encara */ }
  }
  const commentLikesMap = {}
  for (const cl of commentLikesData) {
    if (!commentLikesMap[cl.comment_id]) commentLikesMap[cl.comment_id] = { count: 0, hasLiked: false }
    commentLikesMap[cl.comment_id].count++
    if (cl.user_id === currentUserId) commentLikesMap[cl.comment_id].hasLiked = true
  }

  const liveStatus = betRow?.status ?? bet.status
  const wasPrivate = betRow?.was_private ?? !!channel?.is_private
  const isOwner = channel?.owner_id === currentUserId
  const isMember = isOwner || !!membership
  const restricted = wasPrivate && !isMember

  return {
    message: msg,
    bet: { ...bet, status: liveStatus },
    channel: channel || null,
    posterProfile: posterProfile || null,
    likeCount: (likes || []).length,
    hasLiked: !!myLike,
    comments: (comments || []).map(c => ({ ...c, profile: commentProfileMap[c.user_id] || null })),
    commentLikesMap,
    restricted,
    wasPrivate,
    channelDeleted: !!channel?.deleted_at,
  }
}

export default function PostModal({ messageId: initialMessageId, betId, currentUser, onClose }) {
  const [resolvedMessageId, setResolvedMessageId] = useState(initialMessageId || null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLiked, setHasLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [commentLikesMap, setCommentLikesMap] = useState({})
  const [replyingTo, setReplyingTo] = useState(null) // { id, username }
  const [replyText, setReplyText] = useState('')
  const [reportedComments, setReportedComments] = useState(new Set())
  const [showMenu, setShowMenu] = useState(false)
  const [showForward, setShowForward] = useState(false)
  const [reported, setReported] = useState(false)
  const commentsEndRef = useRef(null)

  const messageId = resolvedMessageId

  useEffect(() => {
    if (!currentUser?.id) return
    setLoading(true)
    const load = async () => {
      let mId = initialMessageId
      if (!mId && betId) {
        mId = await findMessageIdByBet(betId)
        setResolvedMessageId(mId)
      }

      if (mId) {
        const d = await fetchPostData(mId, currentUser.id)
        if (d) {
          setData(d)
          setHasLiked(d.hasLiked)
          setLikeCount(d.likeCount)
          setComments(d.comments)
          setCommentLikesMap(d.commentLikesMap || {})
          setLoading(false)
          return
        }
      }

      // Fallback: llegim directament de bets
      if (betId) {
        const { data: betRow } = await supabase
          .from('bets')
          .select('*, channel:channels(id, name, is_private, deleted_at, owner_id)')
          .eq('id', betId)
          .maybeSingle()

        if (betRow) {
          const { data: posterProfile } = await supabase
            .from('profiles').select('id, username, avatar_url')
            .eq('id', betRow.user_id).maybeSingle()

          const wasPrivate = betRow.was_private || !!betRow.channel?.is_private
          const isOwnBet = betRow.user_id === currentUser.id
          const isChannelOwner = betRow.channel?.owner_id === currentUser.id
          const restricted = wasPrivate && !isOwnBet && !isChannelOwner

          setData({
            message: { id: null, created_at: betRow.created_at, channel_id: betRow.channel_id, user_id: betRow.user_id },
            bet: betRow,
            channel: betRow.channel || null,
            posterProfile: posterProfile || null,
            likeCount: 0, hasLiked: false, comments: [], commentLikesMap: {},
            restricted, wasPrivate,
            channelDeleted: !betRow.channel || !!betRow.channel?.deleted_at,
            noMessage: true,
          })
        }
      }

      setLoading(false)
    }
    load()
  }, [initialMessageId, betId, currentUser?.id])

  const handleLike = async () => {
    if (!data || !messageId) return
    const nowLiked = !hasLiked
    setHasLiked(nowLiked)
    setLikeCount(prev => prev + (nowLiked ? 1 : -1))
    if (nowLiked) {
      await supabase.from('post_likes').insert({ message_id: messageId, user_id: currentUser.id })
      await insertNotification({ userId: data.message.user_id, type: 'like', fromUserId: currentUser.id, fromUsername: currentUser.username || currentUser.name || 'alguien', messageId, preview: data.bet?.event || '' })
    } else {
      await supabase.from('post_likes').delete().eq('message_id', messageId).eq('user_id', currentUser.id)
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || !data) return
    const text = commentText.trim()
    setCommentText('')
    const newComment = {
      id: `tmp-${Date.now()}`,
      user_id: currentUser.id, content: text, created_at: new Date().toISOString(), parent_id: null,
      profile: { username: currentUser.username || currentUser.name, avatar_url: currentUser.avatar_url },
    }
    setComments(prev => [...prev, newComment])
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    if (!messageId) return
    await supabase.from('post_comments').insert({ message_id: messageId, user_id: currentUser.id, content: text, created_at: new Date().toISOString() })
    await insertNotification({ userId: data.message.user_id, type: 'comment', fromUserId: currentUser.id, fromUsername: currentUser.username || currentUser.name || 'alguien', messageId, preview: text.slice(0, 60) })
  }

  const handleCommentLike = async (commentId) => {
    const current = commentLikesMap[commentId] || { count: 0, hasLiked: false }
    const nowLiked = !current.hasLiked
    setCommentLikesMap(prev => ({ ...prev, [commentId]: { count: current.count + (nowLiked ? 1 : -1), hasLiked: nowLiked } }))
    try {
      if (nowLiked) {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id })
      } else {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id)
      }
    } catch {
      // revert si la taula no existeix
      setCommentLikesMap(prev => ({ ...prev, [commentId]: current }))
    }
  }

  const handleReply = async (parentId) => {
    if (!replyText.trim() || !data) return
    const text = replyText.trim()
    setReplyText('')
    setReplyingTo(null)
    const newReply = {
      id: `tmp-${Date.now()}`,
      user_id: currentUser.id, content: text, created_at: new Date().toISOString(), parent_id: parentId,
      profile: { username: currentUser.username || currentUser.name, avatar_url: currentUser.avatar_url },
    }
    setComments(prev => [...prev, newReply])
    if (!messageId) return
    await supabase.from('post_comments').insert({ message_id: messageId, user_id: currentUser.id, content: text, parent_id: parentId, created_at: new Date().toISOString() })
  }

  const forwardContent = data
    ? `[BET]:${JSON.stringify({ id: data.bet?.id, event: data.bet?.event, pick: data.bet?.pick, odds: data.bet?.odds, stake: data.bet?.stake, sport: data.bet?.sport, market: data.bet?.market, date: data.bet?.date, status: data.bet?.status })}`
    : ''

  const cfg = STATUS_CFG[data?.bet?.status] ?? STATUS_CFG.pending
  const topLevelComments = comments.filter(c => !c.parent_id)
  const getReplies = (commentId) => comments.filter(c => c.parent_id === commentId)

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-text-muted)', fontSize: '13px' }}>⏳ Cargando...</div>
          ) : !data ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 30px', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', gap: '12px' }}>
              <div style={{ fontSize: '36px' }}>📋</div>
              <div>No se puede cargar este pick.</div>
              <button onClick={onClose} style={{ marginTop: '8px', padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Cerrar</button>
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
                  {data.posterProfile?.avatar_url
                    ? <img src={data.posterProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (data.posterProfile?.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{data.posterProfile?.username || 'usuario'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{timeAgo(data.message.created_at)}</span>
                    {data.channel && (
                      <>
                        <span>·</span>
                        {data.channelDeleted
                          ? <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Canal eliminado</span>
                          : <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{data.channel.name}</span>}
                      </>
                    )}
                    {data.wasPrivate && (
                      <>
                        <span>·</span>
                        <span style={{ fontSize: '10px', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', padding: '1px 7px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-border)', fontWeight: 600 }}>🔒 Privado</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowMenu(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px' }}>⋮</button>
                  <AnimatePresence>
                    {showMenu && (
                      <>
                        <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          style={{ position: 'absolute', top: '30px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '160px', overflow: 'hidden' }}>
                          <button onClick={() => { setReported(true); setShowMenu(false); setTimeout(() => setReported(false), 3000) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: reported ? 'var(--color-text-muted)' : 'var(--color-error)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                            <span>{reported ? '✓' : '🚩'}</span><span>{reported ? 'Reportado' : 'Reportar'}</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px', lineHeight: 1 }}>×</button>
              </div>

              {/* BODY */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                {/* BET CARD */}
                <div style={{ margin: '16px 16px 0', background: 'var(--color-bg-soft)', border: `0.5px solid ${cfg.border}`, borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ padding: '14px 16px' }}>
                    {data.restricted ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3, flex: 1, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>🔒 Pick privado</div>
                          <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px' }}>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Cuota</div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{parseFloat(data.bet.odds || 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Stake</div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{data.bet.stake}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Únete al canal del tipster para ver el evento, mercado y pick completo.</div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', lineHeight: 1.3, flex: 1 }}>{data.bet.event}</div>
                          <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>{cfg.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {[data.bet.sport, data.bet.market].filter(Boolean).map((t, i) => (
                            <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t}</span>
                          ))}
                          {data.bet.pick && (
                            <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{data.bet.pick}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '24px' }}>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Cuota</div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{parseFloat(data.bet.odds || 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Stake</div>
                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{data.bet.stake}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Fecha</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              {data.bet.date ? new Date(data.bet.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ACTION BAR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px 12px', borderBottom: '0.5px solid var(--color-border)' }}>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: hasLiked ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontWeight: hasLiked ? 700 : 400, borderRadius: 'var(--radius-md)' }}>
                    <span>{hasLiked ? '❤️' : '🤍'}</span>
                    {likeCount > 0 && <span style={{ fontSize: '13px' }}>{likeCount}</span>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.88 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
                    <span>💬</span>
                    {comments.length > 0 && <span style={{ fontSize: '13px' }}>{comments.length}</span>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowForward(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', borderRadius: 'var(--radius-md)' }}>
                    <span style={{ fontSize: '15px' }}>↗️</span>
                    <span>Reenviar</span>
                  </motion.button>
                </div>

                {/* COMMENTS */}
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '60px' }}>
                  {data.restricted ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px', padding: '12px 0', fontStyle: 'italic' }}>
                      Los comentarios solo son visibles para miembros del canal.
                    </div>
                  ) : topLevelComments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '12px 0' }}>
                      Sin comentarios. ¡Sé el primero!
                    </div>
                  ) : topLevelComments.map((c, i) => {
                    const replies = getReplies(c.id)
                    const isReplyingToThis = replyingTo?.id === c.id
                    return (
                      <div key={c.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <CommentItem
                          comment={c}
                          likeInfo={commentLikesMap[c.id]}
                          onLike={() => handleCommentLike(c.id)}
                          onReply={() => setReplyingTo(isReplyingToThis ? null : { id: c.id, username: c.profile?.username })}
                          reported={reportedComments.has(c.id)}
                          onReport={() => setReportedComments(prev => new Set([...prev, c.id]))}
                        />

                        {/* Respostes */}
                        {(replies.length > 0 || isReplyingToThis) && (
                          <div style={{ paddingLeft: '18px', borderLeft: '1.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {replies.map((reply, j) => (
                              <CommentItem
                                key={reply.id || j}
                                comment={reply}
                                likeInfo={commentLikesMap[reply.id]}
                                onLike={() => handleCommentLike(reply.id)}
                                isReply
                                reported={reportedComments.has(reply.id)}
                                onReport={() => setReportedComments(prev => new Set([...prev, reply.id]))}
                              />
                            ))}

                            {/* Input resposta */}
                            {isReplyingToThis && (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  autoFocus
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleReply(c.id)
                                    if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') }
                                  }}
                                  placeholder={`Responder a ${replyingTo.username || 'usuario'}...`}
                                  style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '7px 10px', borderRadius: 'var(--radius-md)', outline: 'none' }}
                                />
                                <button onClick={() => handleReply(c.id)} disabled={!replyText.trim()}
                                  style={{ background: replyText.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: replyText.trim() ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '7px 12px', borderRadius: 'var(--radius-md)', cursor: replyText.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.15s' }}>
                                  ↩
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={commentsEndRef} />
                </div>
              </div>

              {/* COMMENT INPUT */}
              {!data.restricted && (
                <div style={{ borderTop: '0.5px solid var(--color-border)', padding: '12px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                    placeholder="Añade un comentario..."
                    style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none' }}
                  />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleComment} disabled={!commentText.trim()}
                    style={{ background: commentText.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: commentText.trim() ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '10px 16px', borderRadius: 'var(--radius-md)', cursor: commentText.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.15s' }}>
                    Enviar
                  </motion.button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showForward && data && (
          <ForwardModal
            content={forwardContent}
            fromChannelName={data.channel?.name || 'Pick'}
            currentUser={currentUser}
            onClose={() => setShowForward(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
