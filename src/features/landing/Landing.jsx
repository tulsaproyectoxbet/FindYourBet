import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { fadeUp, stagger } from '../../lib/animations'
import { Button } from '../../components/ui/Button'
import AppIcon from '../../components/ui/AppIcon'
import './landing.css'

const HERO_PILLARS = [
  { icon: 'lock',       text: 'Registrado antes del partido' },
  { icon: 'ban',        text: 'Sin ediciones retroactivas' },
  { icon: 'globe',      text: 'Historial 100% público' },
  { icon: 'trendingUp', text: 'Estadísticas automáticas' },
]

const RAIN_ITEMS = (() => {
  const names = [
    'MarcGol', 'SportRoi', 'BetKing', 'TenisPro', 'NBALord', 'GolFever',
    'F1Master', 'EsportsKing', 'BoxStats', 'UFCKing', 'HockeyPro', 'NFLBoss',
    'BeisbolPro', 'GolPicks', 'TennisAce', 'BasketGod', 'SoccerKing', 'F1Wizard',
    'CSKing', 'PadelPro', 'RugbyMan', 'NHLPro', 'MMABet', 'WinnerEU',
  ]
  return names.map(name => {
    const depth = Math.random()
    return { name, left: Math.random() * 94 + 1, duration: 12 + Math.random() * 10, delay: -Math.random() * 22, depth }
  })
})()

function TipsterRain() {
  return (
    <div className="rain" aria-hidden="true">
      {RAIN_ITEMS.map((it, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{
            left:              `${it.left}%`,
            animationDuration: `${it.duration}s`,
            animationDelay:    `${it.delay}s`,
            fontSize:          `${11 + it.depth * 5}px`,
            opacity:           0.07 + it.depth * 0.16,
          }}
        >
          <span className="rain-drop-name">{it.name}</span>
        </span>
      ))}
    </div>
  )
}

export default function Landing({ navigate, user }) {
  const heroRef    = useRef(null)
  const rrNavigate = useNavigate()
  const goLegal    = (slug) => rrNavigate(`/legal/${slug}`)

  const onMove = (e) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div className="landing">

      {/* NAV */}
      <motion.nav
        className="nav"
        style={{ x: '-50%' }}
        initial={{ opacity: 0, y: -120, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          y:       { type: 'spring', stiffness: 220, damping: 22, mass: 0.9, delay: 0.15 },
          opacity: { duration: 0.4, delay: 0.15 },
          scale:   { type: 'spring', stiffness: 300, damping: 24, delay: 0.15 },
        }}
      >
        <div
          className="nav-logo"
          onClick={() => navigate('landing')}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('landing')}
        >
          FindYour<span>Bet</span>
        </div>

        <nav className="nav-links">
          <a className="nav-link" onClick={() => rrNavigate('/info/como-funciona')} style={{ cursor: 'pointer' }}>Cómo funciona</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/tipsters')}      style={{ cursor: 'pointer' }}>Tipsters</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/ranking')}       style={{ cursor: 'pointer' }}>Ranking</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/precios')}       style={{ cursor: 'pointer' }}>Precios</a>
        </nav>

        <div className="nav-btns">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>Ir al Dashboard</Button>
              <div className="nav-user-chip" style={{ cursor: 'pointer' }} onClick={() => navigate('dashboard')}>
                <span className="nav-user-dot" />
                <span className="nav-user-name">{user.username || user.email}</span>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('login')}>Iniciar sesión</Button>
              <Button size="sm" onClick={() => navigate('register')}>Registrarse</Button>
            </>
          )}
        </div>
      </motion.nav>

      {/* HERO (100dvh) */}
      <section className="hero-full" ref={heroRef} onMouseMove={onMove}>
        <TipsterRain />

        <motion.div className="hero-center" initial="hidden" animate="visible" variants={stagger}>
          <motion.h1 className="hero-h1" variants={fadeUp} custom={0}>
            La primera red social<br />
            de pronósticos donde<br />
            <em>los resultados no<br className="hero-br" />se pueden maquillar</em>
          </motion.h1>

          <motion.p className="hero-sub" variants={fadeUp} custom={1}>
            Picks registrados antes del partido. Historial inmutable y público.
            Estadísticas que no se inventan.
          </motion.p>

          <motion.div className="hero-btns" variants={fadeUp} custom={2}>
            {user ? (
              <Button onClick={() => navigate('dashboard')}>Ir al Dashboard</Button>
            ) : (
              <>
                <Button onClick={() => navigate('register')}>Empezar gratis</Button>
                <Button variant="ghost" onClick={() => navigate('login')}>Ya tengo cuenta</Button>
              </>
            )}
          </motion.div>

          <motion.div className="hero-pillars" variants={fadeUp} custom={3}>
            {HERO_PILLARS.map((p, i) => (
              <div key={i} className="hero-pill">
                <AppIcon name={p.icon} size={12} color="rgba(0,255,138,0.6)" />
                <span>{p.text}</span>
              </div>
            ))}
          </motion.div>

        </motion.div>
      </section>

      {/* FOOTER COMPACTE */}
      <footer className="footer-compact">
        <div className="footer-legal-links">
          <a onClick={() => goLegal('aviso-legal')}       style={{ cursor: 'pointer' }}>Aviso legal</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('terminos')}          style={{ cursor: 'pointer' }}>Términos</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('privacidad')}        style={{ cursor: 'pointer' }}>Privacidad</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('cookies')}           style={{ cursor: 'pointer' }}>Cookies</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('juego-responsable')} style={{ cursor: 'pointer' }}>Juego responsable</a>
          <span className="footer-dot" />
          <a onClick={() => rrNavigate('/contacto')}      style={{ cursor: 'pointer' }}>Contacto</a>
        </div>
        <div className="footer-compact-bottom">
          <span>© {new Date().getFullYear()} FindYourBet · Juega con responsabilidad</span>
          <span className="footer-bottom-tag">+18</span>
        </div>
      </footer>

    </div>
  )
}
