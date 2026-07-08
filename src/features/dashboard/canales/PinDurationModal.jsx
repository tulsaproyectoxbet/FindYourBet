import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../../components/ui/AppIcon'

const DURATIONS = [
  { labelKey: 'pinDuration.indefinite', ms: null },
  { labelKey: 'mutes.1h', ms: 3_600_000 },
  { labelKey: 'mutes.3h', ms: 10_800_000 },
  { labelKey: 'mutes.1d', ms: 86_400_000 },
  { labelKey: 'mutes.2d', ms: 172_800_000 },
  { labelKey: 'mutes.7d', ms: 604_800_000 },
  { labelKey: 'mutes.30d', ms: 2_592_000_000 },
]

export default function PinDurationModal({ onSelect, onClose }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '480px', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="pin" size={14} /> {t('pinDuration.title')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px 6px', display: 'flex' }}><AppIcon name="close" size={18} /></button>
        </div>
        {DURATIONS.map((d, i) => (
          <button key={d.labelKey} onClick={() => onSelect(d.ms)}
            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 20px', background: 'none', border: 'none', borderBottom: i < DURATIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)', fontWeight: d.ms === null ? 700 : 400 }}>
            {t(d.labelKey)}
          </button>
        ))}
        <div style={{ height: '16px' }} />
      </motion.div>
    </motion.div>
  )
}
