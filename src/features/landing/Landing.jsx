import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fadeUp, stagger } from '../../lib/animations'
import { Button } from '../../components/ui/Button'
import AppIcon from '../../components/ui/AppIcon'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'
import './landing.css'

const HERO_PILLARS = [
  { icon: 'lock',       textKey: 'landing.pillars.registered' },
  { icon: 'ban',        textKey: 'landing.pillars.noEdits' },
  { icon: 'globe',      textKey: 'landing.pillars.publicHistory' },
  { icon: 'trendingUp', textKey: 'landing.pillars.autoStats' },
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
  const { t } = useTranslation()
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
          <a className="nav-link" onClick={() => rrNavigate('/info/como-funciona')} style={{ cursor: 'pointer' }}>{t('landing.nav.howItWorks')}</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/tipsters')}      style={{ cursor: 'pointer' }}>{t('landing.nav.tipsters')}</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/ranking')}       style={{ cursor: 'pointer' }}>{t('landing.nav.ranking')}</a>
          <a className="nav-link" onClick={() => rrNavigate('/info/precios')}       style={{ cursor: 'pointer' }}>{t('landing.nav.pricing')}</a>
        </nav>

        <div className="nav-btns">
          {user ? (
            <>
              <LanguageSwitcher compact />
              <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>{t('landing.nav.goToDashboard')}</Button>
              <div className="nav-user-chip" style={{ cursor: 'pointer' }} onClick={() => navigate('dashboard')}>
                <span className="nav-user-dot" />
                <span className="nav-user-name">{user.username || user.email}</span>
              </div>
            </>
          ) : (
            <>
              <LanguageSwitcher compact />
              <Button variant="ghost" size="sm" onClick={() => navigate('login')}>{t('landing.nav.signIn')}</Button>
              <Button size="sm" onClick={() => navigate('register')}>{t('landing.nav.signUp')}</Button>
            </>
          )}
        </div>
      </motion.nav>

      {/* HERO (100dvh) */}
      <section className="hero-full" ref={heroRef} onMouseMove={onMove}>
        <TipsterRain />

        <motion.div className="hero-center" initial="hidden" animate="visible" variants={stagger}>
          <motion.h1 className="hero-h1" variants={fadeUp} custom={0}
            dangerouslySetInnerHTML={{ __html: t('landing.hero.title') }}
          />

          <motion.p className="hero-sub" variants={fadeUp} custom={1}>
            {t('landing.hero.subtitle')}
          </motion.p>

          <motion.div className="hero-btns" variants={fadeUp} custom={2}>
            {user ? (
              <Button onClick={() => navigate('dashboard')}>{t('landing.hero.goToDashboard')}</Button>
            ) : (
              <>
                <Button onClick={() => navigate('register')}>{t('landing.hero.startFree')}</Button>
                <Button variant="ghost" onClick={() => navigate('login')}>{t('landing.hero.alreadyHaveAccount')}</Button>
              </>
            )}
          </motion.div>

          <motion.div className="hero-pillars" variants={fadeUp} custom={3}>
            {HERO_PILLARS.map((p, i) => (
              <div key={i} className="hero-pill">
                <AppIcon name={p.icon} size={12} color="rgba(0,255,138,0.6)" />
                <span>{t(p.textKey)}</span>
              </div>
            ))}
          </motion.div>

        </motion.div>
      </section>

      {/* FOOTER COMPACTE */}
      <footer className="footer-compact">
        <div className="footer-legal-links">
          <a onClick={() => goLegal('aviso-legal')}       style={{ cursor: 'pointer' }}>{t('landing.footer.legalNotice')}</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('terminos')}          style={{ cursor: 'pointer' }}>{t('landing.footer.terms')}</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('privacidad')}        style={{ cursor: 'pointer' }}>{t('landing.footer.privacy')}</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('cookies')}           style={{ cursor: 'pointer' }}>{t('landing.footer.cookies')}</a>
          <span className="footer-dot" />
          <a onClick={() => goLegal('juego-responsable')} style={{ cursor: 'pointer' }}>{t('landing.footer.responsibleGambling')}</a>
          <span className="footer-dot" />
          <a onClick={() => rrNavigate('/contacto')}      style={{ cursor: 'pointer' }}>{t('landing.footer.contact')}</a>
        </div>
        <div className="footer-compact-bottom">
          <span>© {new Date().getFullYear()} FindYourBet · {t('landing.footer.tagline')}</span>
          <span className="footer-bottom-tag">+18</span>
        </div>
      </footer>

    </div>
  )
}
