import { motion } from 'framer-motion'
import AppIcon from './AppIcon'

// SVG del coet amb il·luminació verda i logo FYB
function RocketIllustration() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e676" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="flameGrad" cx="50%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#00e676" stopOpacity="1" />
          <stop offset="60%" stopColor="#00c853" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="cloudBlur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Halo de llum verd de fons */}
      <ellipse cx="110" cy="155" rx="70" ry="30" fill="url(#glowGrad)" filter="url(#softGlow)" opacity="0.8" />

      {/* Anell circular */}
      <circle cx="110" cy="95" r="62" stroke="#1a3a2a" strokeWidth="1.5" fill="none" opacity="0.7" />
      <circle cx="110" cy="95" r="62" stroke="#00e676" strokeWidth="0.5" fill="none" opacity="0.3" />

      {/* Estrelles */}
      {[
        [42, 38], [178, 30], [25, 90], [195, 75], [55, 160], [170, 150], [148, 22], [68, 170]
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill="#00e676" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      <circle cx="185" cy="108" r="1.8" fill="#00e676" opacity="0.6" />
      <circle cx="30" cy="55" r="1.5" fill="#00e676" opacity="0.5" />

      {/* Flames / foc del coet (sota) */}
      <ellipse cx="110" cy="158" rx="12" ry="22" fill="url(#flameGrad)" filter="url(#glow)" opacity="0.9" />
      <ellipse cx="110" cy="165" rx="7" ry="14" fill="#00ff88" filter="url(#glow)" opacity="0.6" />

      {/* Núvols de fum */}
      <ellipse cx="82" cy="165" rx="20" ry="10" fill="#1a3a2a" filter="url(#cloudBlur)" opacity="0.9" />
      <ellipse cx="138" cy="165" rx="20" ry="10" fill="#1a3a2a" filter="url(#cloudBlur)" opacity="0.9" />
      <ellipse cx="95" cy="172" rx="25" ry="12" fill="#152e20" filter="url(#cloudBlur)" opacity="0.8" />
      <ellipse cx="125" cy="172" rx="25" ry="12" fill="#152e20" filter="url(#cloudBlur)" opacity="0.8" />
      <ellipse cx="110" cy="175" rx="30" ry="10" fill="#0f2218" filter="url(#cloudBlur)" opacity="0.7" />

      {/* Plataforma de llançament */}
      <rect x="76" y="158" width="68" height="6" rx="3" fill="#1e3a2a" stroke="#2a4a35" strokeWidth="0.5" />
      <circle cx="89" cy="161" r="2" fill="#00e676" opacity="0.5" />
      <circle cx="131" cy="161" r="2" fill="#00e676" opacity="0.5" />

      {/* COS DEL COET */}
      {/* Cos principal */}
      <path d="M95 145 Q95 60 110 38 Q125 60 125 145 Z" fill="#1c2e24" stroke="#2a4035" strokeWidth="1" />
      {/* Brillantor lateral */}
      <path d="M110 42 Q118 65 122 100 Q120 130 119 145 L125 145 Q125 60 110 38 Z" fill="#243a2c" opacity="0.5" />

      {/* Finestreta/ull */}
      <circle cx="110" cy="95" r="18" fill="#0d1f15" stroke="#2a4a35" strokeWidth="1.5" />
      <circle cx="110" cy="95" r="14" fill="#0a1a12" stroke="#1e3a28" strokeWidth="1" />
      {/* Badge FYB */}
      <circle cx="110" cy="95" r="11" fill="#0f2a1a" stroke="#00e676" strokeWidth="1" opacity="0.9" />
      <text x="110" y="99" textAnchor="middle" fill="#00e676" fontSize="8" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.5">FYB</text>

      {/* Aletes del coet */}
      <path d="M95 135 L80 155 L95 150 Z" fill="#1a3028" stroke="#243a30" strokeWidth="0.8" />
      <path d="M125 135 L140 155 L125 150 Z" fill="#1a3028" stroke="#243a30" strokeWidth="0.8" />

      {/* Detalls decoratius del cos */}
      <line x1="102" y1="115" x2="118" y2="115" stroke="#2a4a35" strokeWidth="0.8" opacity="0.6" />
      <line x1="100" y1="125" x2="120" y2="125" stroke="#2a4a35" strokeWidth="0.8" opacity="0.6" />
    </svg>
  )
}

/**
 * Placeholder per a funcions pròximament disponibles.
 * Props opcionals: title, subtitle, note
 */
export default function ComingSoon({
  title = 'Esta función estará disponible',
  highlight = 'más adelante.',
  subtitle = 'Estamos trabajando para traerte algo increíble.\nMuy pronto podrás disfrutar de esta nueva funcionalidad.',
  note = '¡Se viene algo grande!',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', textAlign: 'center', userSelect: 'none',
      }}
    >
      {/* Coet animat */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ marginBottom: '28px' }}
      >
        <RocketIllustration />
      </motion.div>

      {/* Títol */}
      <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.3, marginBottom: '14px', maxWidth: '340px' }}>
        {title}{' '}
        <span style={{ color: 'var(--color-primary)' }}>{highlight}</span>
      </div>

      {/* Subtítol */}
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.7, maxWidth: '320px', marginBottom: '28px', whiteSpace: 'pre-line' }}>
        {subtitle}
      </div>

      {/* Separador amb rellotge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '280px', marginBottom: '20px' }}>
        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border)' }} />
        <AppIcon name="clock" size={16} color="var(--color-primary)" />
        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border)' }} />
      </div>

      {/* Pill inferior */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px', borderRadius: '999px',
        background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
        fontSize: '13px', color: 'var(--color-text-muted)',
      }}>
        <AppIcon name="bell" size={14} color="var(--color-primary)" />
        <span>Gracias por tu paciencia. {note}</span>
      </div>
    </motion.div>
  )
}
