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
  const [showMuteMenu, setShowMuteMenu] = useState(false)
  const { mute, unmute, isMuted, muteLabel } = useMutes()
  const muteKey = `channel_${channel.id}`
  const muted = isMuted(muteKey)

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
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              style={{ fontSize: '12px', padding: '5px 10px', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-error)', cursor: 'pointer' }}>
              🗑️
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => { onDelete(channel.id); setConfirmDelete(false) }}
                style={{ fontSize: '11px', padding: '5px 10px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-error)', color: '#fff', cursor: 'pointer' }}>
                Confirmar
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ fontSize: '11px', padding: '5px 10px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          )}
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
