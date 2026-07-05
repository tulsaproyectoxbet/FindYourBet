import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp } from '../../../lib/animations'
import { supabase } from '../../../lib/supabase'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { formatMsgPreview as formatLastMsg } from '../../../lib/formatMsgPreview'
import { clampLines, stripEmojis, LINE_LIMIT } from '../../../lib/textLimits'
import AppIcon from '../../../components/ui/AppIcon'


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

const menuBtn = { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }

function ActionMenu({ isPinned, muted, isOwner, onPin, onUnpin, onSilenciar, onActivar, onDelete, onLeave, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
      <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
        style={{ position: 'absolute', top: '32px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '190px', overflow: 'hidden' }}>
        <button onClick={isPinned ? onUnpin : onPin}
          style={{ ...menuBtn, borderBottom: '0.5px solid var(--color-border)' }}>
          {isPinned ? <><AppIcon name="pin" size={14} /> Desanclar</> : <><AppIcon name="pin" size={14} /> Anclar</>}
        </button>
        <button onClick={muted ? onActivar : onSilenciar}
          style={{ ...menuBtn, borderBottom: '0.5px solid var(--color-border)' }}>
          {muted ? <><AppIcon name="bell" size={14} /> Activar notificaciones</> : <><AppIcon name="bellOff" size={14} /> Silenciar</>}
        </button>
        <button onClick={isOwner ? onDelete : onLeave}
          style={{ ...menuBtn, color: 'var(--color-error)' }}>
          {isOwner ? <><AppIcon name="delete" size={14} /> Eliminar canal</> : <><AppIcon name="leave" size={14} /> Salir del canal</>}
        </button>
      </motion.div>
    </>
  )
}

function MuteMenu({ muteKey, isMuted, muteLabel, onMute, onUnmute, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
      <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
        style={{ position: 'absolute', top: '32px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '160px', overflow: 'hidden' }}>
        {isMuted && (
          <button onClick={() => { onUnmute(); onClose() }}
            style={{ ...menuBtn, borderBottom: '0.5px solid var(--color-border)', color: 'var(--color-primary)', fontWeight: 700 }}>
            <AppIcon name="bell" size={14} /> Activar notificaciones
          </button>
        )}
        {MUTE_DURATIONS.map((d, i) => (
          <button key={i} onClick={() => { onMute(d.ms); onClose() }}
            style={{ ...menuBtn, borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
            {d.label}
          </button>
        ))}
      </motion.div>
    </>
  )
}

export default function ChannelCard({ channel, onClick, onLeave, onDelete, onAdminDeleted, isOwner, memberCount, lastMessage, unreadCount = 0, isPinned = false, onPin, onUnpin }) {
  const { adminMode } = useAdminMode()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [showMuteMenu, setShowMuteMenu] = useState(false)
  const [showAdminDelete, setShowAdminDelete] = useState(false)
  const [adminReason, setAdminReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleAdminDelete = async () => {
    if (!adminReason.trim()) { alert('Escribe el motivo de la eliminación'); return }
    setDeleting(true)
    const { error } = await supabase.from('channels').update({
      deleted_at: new Date().toISOString(),
      deletion_reason: adminReason.trim(),
      deletion_notified: false,
    }).eq('id', channel.id)
    setDeleting(false)
    if (error) { alert('Error: ' + error.message); return }
    setShowAdminDelete(false)
    setAdminReason('')
    onAdminDeleted?.(channel.id)
  }

  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const muteKey = `channel_${channel.id}`
  const muted = isMuted(muteKey)

  if (confirmDelete) {
    return (
      <motion.div layout variants={fadeUp}
        style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="warning" size={13} /> Esta acción es irreversible</div>
        <div style={{ fontSize: '12px', color: 'var(--color-error)', lineHeight: 1.5 }}>
          Se eliminarán permanentemente todos los mensajes, picks e historial del canal <strong>"{channel.name}"</strong>.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Escribe <strong style={{ color: 'var(--color-error)', letterSpacing: '0.5px' }}>ELIMINAR</strong> para confirmar:
        </div>
        <input
          autoFocus
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          placeholder="ELIMINAR"
          maxLength={8}
          style={{ width: '100%', background: 'var(--color-bg)', border: `1.5px solid ${deleteInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-error-border)'}`, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', letterSpacing: '1px' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            Cancelar
          </button>
          <button
            onClick={() => { onDelete(channel.id); setConfirmDelete(false); setDeleteInput('') }}
            disabled={deleteInput !== 'ELIMINAR'}
            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteInput === 'ELIMINAR' ? '#fff' : 'var(--color-text-muted)', cursor: deleteInput === 'ELIMINAR' ? 'pointer' : 'default', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            Eliminar canal
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div layout variants={fadeUp}
      style={{ background: 'var(--color-bg)', border: `0.5px solid ${isOwner ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>

      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '42px', height: '42px', background: isOwner ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, color: isOwner ? 'var(--color-primary)' : 'var(--color-text-muted)', border: '0.5px solid var(--color-border)', overflow: 'hidden', opacity: muted ? 0.6 : 1 }}>
            {channel.avatar_url ? <img src={channel.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : channel.name[0].toUpperCase()}
          </div>
          {unreadCount > 0 && !muted && (
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '18px', height: '18px', background: 'var(--color-error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', border: '2px solid var(--color-bg)', padding: '0 3px', boxSizing: 'border-box' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', opacity: muted ? 0.6 : 1 }}>
            {isPinned && <span style={{ display: 'inline-flex', alignItems: 'center' }}><AppIcon name="pin" size={12} /></span>}
            {channel.name}
            {channel.channel_type === 'free_private' && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', border: '0.5px solid var(--color-border)', padding: '1px 7px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AppIcon name="lock" size={10} /> Privado</span>
            )}
            {channel.deleted_at && <span style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: 700, background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', padding: '1px 8px', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AppIcon name="warning" size={10} /> Eliminado</span>}
            {muted && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AppIcon name="bellOff" size={10} /> {muteLabel(muteKey)}</span>}
            {lastMessage && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>{timeAgo(lastMessage.created_at)}</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', opacity: muted ? 0.6 : 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {lastMessage ? formatLastMsg(lastMessage.content) : (channel.description || 'Sin mensajes aún')}
          </div>
        </div>
      </div>

      {/* Right side: Propietario badge + ⋮ menu */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        {isOwner && (
          <span style={{ fontSize: '11px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Propietario</span>
        )}

        {/* ⋮ context menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setShowActionMenu(v => !v); setShowMuteMenu(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '4px 6px', borderRadius: 'var(--radius-sm)', lineHeight: 1, fontWeight: 700, letterSpacing: '0.5px' }}>
            ⋮
          </button>
          <AnimatePresence>
            {showActionMenu && (
              <ActionMenu
                isPinned={isPinned}
                muted={muted}
                isOwner={isOwner}
                onPin={() => { onPin?.(channel.id); setShowActionMenu(false) }}
                onUnpin={() => { onUnpin?.(channel.id); setShowActionMenu(false) }}
                onSilenciar={() => { setShowActionMenu(false); setShowMuteMenu(true) }}
                onActivar={() => { unmute(muteKey); setShowActionMenu(false) }}
                onDelete={() => { setShowActionMenu(false); setConfirmDelete(true); setDeleteInput('') }}
                onLeave={() => { setShowActionMenu(false); onLeave?.() }}
                onClose={() => setShowActionMenu(false)}
              />
            )}
            {showMuteMenu && (
              <MuteMenu
                muteKey={muteKey}
                isMuted={muted}
                muteLabel={muteLabel(muteKey)}
                onMute={ms => mute(muteKey, ms)}
                onUnmute={() => unmute(muteKey)}
                onClose={() => setShowMuteMenu(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Botó admin: eliminar amb motiu — només en mode admin si NO ets l'owner */}
        {adminMode && !isOwner && (
          <button onClick={e => { e.stopPropagation(); setShowAdminDelete(true); setAdminReason('') }}
            title="Eliminar como admin"
            style={{ fontSize: '14px', padding: '5px 10px', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer' }}>
            <AppIcon name="shield" size={14} />
          </button>
        )}
      </div>

      {/* Modal admin delete amb motiu */}
      <AnimatePresence>
        {showAdminDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAdminDelete(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="shield" size={16} /> Eliminar canal como admin</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                Canal: <strong style={{ color: 'var(--color-text)' }}>{channel.name}</strong>
              </div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Motivo (visible al propietario)</label>
              <textarea value={adminReason} onChange={e => setAdminReason(clampLines(stripEmojis(e.target.value), LINE_LIMIT.FORM))} rows={4}
                placeholder="Explica por qué se elimina este canal..." maxLength={500}
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdminDelete(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleAdminDelete} disabled={deleting || !adminReason.trim()}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: deleting || !adminReason.trim() ? 0.5 : 1 }}>
                  {deleting ? 'Eliminando...' : 'Eliminar canal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
