import { motion, AnimatePresence } from 'framer-motion'

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

const TYPE_CFG = {
  like:         { icon: '❤️', text: (n) => `@${n.from_username} le dio like a tu pick${n.preview ? ` · ${n.preview}` : ''}` },
  comment:      { icon: '💬', text: (n) => `@${n.from_username} comentó: "${n.preview}"` },
  channel_join: { icon: '👥', text: (n) => `@${n.from_username} se unió a tu canal` },
  dm:           { icon: '✉️', text: (n) => `@${n.from_username} te envió un mensaje` },
}

function NotifItem({ n }) {
  const cfg = TYPE_CFG[n.type] || { icon: '🔔', text: () => n.preview || 'Nueva notificación' }

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '0.5px solid var(--color-border)' }}>
      <div style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', lineHeight: 1.4, color: 'var(--color-text)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {cfg.text(n)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{timeAgo(n.created_at)}</div>
      </div>
    </div>
  )
}

export default function NotificationsPanel({ notifications, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '360px', maxWidth: '90vw', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 99, overflow: 'hidden', maxHeight: '480px', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Notificaciones</div>
        </div>

        {/* LLISTA */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
              <div style={{ fontSize: '13px' }}>Sin notificaciones aún</div>
            </div>
          ) : (
            notifications.map(n => (
              <NotifItem key={n.id} n={n} />
            ))
          )}
        </div>
      </motion.div>
    </>
  )
}
