// Mostra un username acompanyat del badge de verificat si l'usuari està verificat.
// Es fa servir a tot arreu on aparegui un username perquè el tick sigui un complement permanent.
import AppIcon from './AppIcon'

const SIZE_MAP = {
  xs: { badge: 11, font: 8, gap: 3 },
  sm: { badge: 13, font: 9, gap: 4 },
  md: { badge: 15, font: 9, gap: 5 },
  lg: { badge: 18, font: 11, gap: 6 },
  xl: { badge: 22, font: 13, gap: 7 },
}

export function VerifiedBadge({ size = 'sm', style }) {
  const cfg = SIZE_MAP[size] || SIZE_MAP.sm
  return (
    <span
      title="Verificado"
      aria-label="Verificado"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: cfg.badge,
        height: cfg.badge,
        borderRadius: '50%',
        background: 'var(--color-primary)',
        color: '#010906',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <AppIcon name="check" size={cfg.font} />
    </span>
  )
}

export default function Username({ username, isVerified, size = 'sm', prefix = '', style, badgeStyle }) {
  const cfg = SIZE_MAP[size] || SIZE_MAP.sm
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: `${cfg.gap}px`, minWidth: 0, ...style }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {prefix}{username}
      </span>
      {isVerified && <VerifiedBadge size={size} style={badgeStyle} />}
    </span>
  )
}
