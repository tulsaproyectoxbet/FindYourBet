import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp } from '../../../lib/animations'
import { useMutes, MUTE_DURATIONS } from '../../../hooks/useMutes'

function MuteMenu({ muteKey, isMuted, muteLabel, onMute, onUnmute, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
      <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
        style={{ position: 'absolute', top: '32px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '160px', overflow: 'hidden' }}>
        {isMuted && (
          <button onClick={() => { onUnmute(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            🔔 Activar notificaciones
          </button>
        )}
        {MUTE_DURATIONS.map((d, i) => (
          <button key={i} onClick={() => { onMute(d.ms); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < MUTE_DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            {d.label}
          </button>
        ))}
      </motion.div>
    </>
  )
}

export default function ChannelCard({ channel, onClick, onLeave, onDelete, isOwner, memberCount }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [showMuteMenu, setShowMuteMenu] = useState(false)
  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const muteKey = `channel_${channel.id}`
  const muted = isMuted(muteKey)

  if (confirmDelete) {
    return (
      <motion.div variants={fadeUp}
        style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-error)' }}>⚠️ Esta acción es irreversible</div>
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
    <motion.div variants={fadeUp}
      style={{ background: 'var(--color-bg)', border: `0.5px solid ${isOwner ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>

      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
        <div style={{ width: '42px', height: '42px', background: isOwner ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 700, color: isOwner ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0, border: '0.5px solid var(--color-border)', overflow: 'hidden', opacity: muted ? 0.6 : 1 }}>
          {channel.avatar_url ? <img src={channel.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : channel.name[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', opacity: muted ? 0.6 : 1 }}>
            {channel.name}
            {channel.deleted_at && <span style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: 700, background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', padding: '1px 8px', borderRadius: 'var(--radius-full)' }}>⚠️ Eliminado</span>}
            {muted && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 400 }}>🔕 {muteLabel(muteKey)}</span>}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', gap: '8px', opacity: muted ? 0.6 : 1 }}>
            {channel.description && <span>{channel.description} ·</span>}
            <span>👥 {memberCount ?? '...'} participantes</span>
          </div>
        </div>
      </div>

      {/* Botó silenciar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); setShowMuteMenu(v => !v) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: muted ? 'var(--color-text-muted)' : 'var(--color-text-muted)', padding: '4px', borderRadius: 'var(--radius-sm)', opacity: muted ? 0.5 : 0.7 }}>
          {muted ? '🔕' : '🔔'}
        </button>
        <AnimatePresence>
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

      {isOwner ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Propietario</span>
          <button onClick={() => { setConfirmDelete(true); setDeleteInput('') }}
            style={{ fontSize: '12px', padding: '5px 10px', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-error)', cursor: 'pointer' }}>
            🗑️
          </button>
        </div>
      ) : (
        <button onClick={onLeave}
          style={{ fontSize: '12px', padding: '5px 12px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 }}>
          Salir
        </button>
      )}
    </motion.div>
  )
}
