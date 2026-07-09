import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AppIcon from './AppIcon'

export default function MaintenanceOverlay({ message, estimatedDuration, onExit }) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', textAlign: 'center',
      }}
    >
      {/* Logo */}
      <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '32px', color: 'var(--color-text)' }}>
        FindYour<span style={{ color: 'var(--color-primary)' }}>Bet</span>
      </div>

      {/* Icona */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'var(--color-bg-soft)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <AppIcon name="tool" size={32} color="var(--color-primary)" />
      </div>

      {/* Títol */}
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text)' }}>
        {t('maintenance.title')}
      </h2>

      {/* Missatge custom o subtítol per defecte */}
      <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', maxWidth: '360px', lineHeight: 1.6, marginBottom: '24px' }}>
        {message || t('maintenance.subtitle')}
      </p>

      {/* Duració estimada */}
      {estimatedDuration && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', borderRadius: 'var(--radius-full)',
          background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)',
          fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)',
          marginBottom: '32px',
        }}>
          <AppIcon name="clock" size={13} />
          <span>{t('maintenance.estimated')}: {estimatedDuration}</span>
        </div>
      )}

      {/* Botó sortir */}
      <button
        onClick={onExit}
        style={{
          padding: '12px 32px', borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary)', border: 'none',
          color: '#010906', fontWeight: 700, fontSize: '15px',
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          marginTop: estimatedDuration ? '0' : '8px',
        }}
      >
        {t('maintenance.exit')}
      </button>
    </motion.div>
  )
}
