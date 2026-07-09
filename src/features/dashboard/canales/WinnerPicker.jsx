import { motion } from 'framer-motion'
import { WINNER_TEMPLATES } from '../../../lib/winnerTemplates'
import WinnerCard from './WinnerCard'
import AppIcon from '../../../components/ui/AppIcon'

export default function WinnerPicker({ currentUser, onSend, onClose }) {
  const handleSelectTemplate = (tpl) => {
    onSend(tpl.id)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        position: 'absolute', bottom: '100%', right: 0,
        marginBottom: '8px', zIndex: 100, width: '320px',
        background: 'var(--color-bg)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '12px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AppIcon name="trophy" size={14} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>Victorias</span>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '2px' }}>
          <AppIcon name="close" size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {WINNER_TEMPLATES.map(tpl => (
          <button key={tpl.id} onClick={() => handleSelectTemplate(tpl)}
            style={{
              position: 'relative', padding: 0,
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              cursor: 'pointer', background: 'var(--color-bg-soft)',
              aspectRatio: `${tpl.imgW}/${tpl.imgH}`,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          >
            <WinnerCard tpl={tpl.id} avatar={currentUser?.avatar_url} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              fontSize: '10px', fontWeight: 700, color: '#fff',
              pointerEvents: 'none',
            }}>
              {tpl.label}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
