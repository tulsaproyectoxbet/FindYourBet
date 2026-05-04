import { useEffect, useId, useRef } from 'react'
import { motion, useInView, animate } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'
import { Button } from '../../components/ui/Button'
import './landing.css'

const NAV_LINKS = ['Tipsters', 'Ranking', 'Cómo funciona', 'Precios']

const NAV_SCROLL = {
  'Tipsters':      'section-ranking',
  'Ranking':       'section-ranking',
  'Cómo funciona': 'section-features',
  'Precios':       'section-cta',
}

const STATS = [
  { num: '1.240',  label: 'Tipsters activos' },
  { num: '98.400', label: 'Apuestas auditadas' },
  { num: '+34%',   label: 'ROI medio top 10' },
  { num: '12',     label: 'Categorías disponibles' },
]

const FEATURES = [
  { title: 'Track record auditado',  desc: 'Cada apuesta verificada y registrada. No hay forma de modificar el historial.' },
  { title: 'Ranking transparente',   desc: 'Ordenado por ROI real, racha y volumen. Los mejores arriba, siempre.' },
  { title: 'Suscripciones VIP',      desc: 'Accede a las apuestas privadas de los tipsters que más te interesan.' },
  { title: 'Chat en tiempo real',    desc: 'Los tipsters publican picks y análisis. Interactúa con la comunidad.' },
  { title: 'Tus estadísticas',       desc: 'Lleva un control de tus apuestas, ROI y evolución en el tiempo.' },
  { title: '12 categorías',          desc: 'Fútbol, baloncesto, tenis, eSports y más. Filtra por lo que te interesa.' },
]

const TIPSTERS = [
  { rank: '#1', initials: 'MG', name: 'MarcGol',   sport: 'Fútbol · La Liga',    roi: '+41%', acierto: '87%', picks: '312', spark: [10,12,9,14,18,16,22,24,27,31,35,41] },
  { rank: '#2', initials: 'SR', name: 'SportRoi',  sport: 'Baloncesto · NBA',    roi: '+38%', acierto: '81%', picks: '198', spark: [5,8,11,9,15,20,18,25,22,30,34,38] },
  { rank: '#3', initials: 'BK', name: 'BetKing',   sport: 'Tenis · ATP',         roi: '+29%', acierto: '76%', picks: '445', spark: [2,5,4,8,12,10,15,18,20,23,26,29] },
]

const RAIN_ITEMS = (() => {
  const list = [
    { name: 'MarcGol',     val: '+41%' },
    { name: 'SportRoi',    val: '+38%' },
    { name: 'BetKing',     val: '+29%' },
    { name: 'TenisPro',    val: '+52%' },
    { name: 'NBALord',     val: '+33%' },
    { name: 'GolFever',    val: '+27%' },
    { name: 'F1Master',    val: '+45%' },
    { name: 'EsportsKing', val: '+36%' },
    { name: 'BoxStats',    val: '+22%' },
    { name: 'UFCKing',     val: '+39%' },
    { name: 'HockeyPro',   val: '+31%' },
    { name: 'NFLBoss',     val: '+34%' },
    { name: 'BeisbolPro',  val: '+28%' },
    { name: 'GolPicks',    val: '+44%' },
    { name: 'TennisAce',   val: '+30%' },
    { name: 'BasketGod',   val: '+37%' },
    { name: 'SoccerKing',  val: '+42%' },
    { name: 'F1Wizard',    val: '+25%' },
    { name: 'CSKing',      val: '+48%' },
    { name: 'PadelPro',    val: '+32%' },
    { name: 'RugbyMan',    val: '+26%' },
    { name: 'NHLPro',      val: '+35%' },
    { name: 'MMABet',      val: '+40%' },
    { name: 'WinnerEU',    val: '+47%' },
  ]
  return list.map(it => {
    const depth = Math.random()
    return {
      ...it,
      left:     Math.random() * 94 + 1,
      duration: 12 + Math.random() * 10,
      delay:    -Math.random() * 22,
      depth,
    }
  })
})()

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'eSports', 'Béisbol', 'Hockey', 'F1', 'UFC', 'Golf', 'Boxeo', 'Rugby', 'NFL']

function AnimatedNum({ value }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const sign = value.startsWith('+') ? '+' : ''
  const isPct = value.endsWith('%')
  const target = parseInt(value.replace(/[+%]/g, '').replace(/\./g, ''), 10)

  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const controls = animate(0, target, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        const n = Math.round(v).toLocaleString('es-ES')
        node.textContent = `${sign}${n}${isPct ? '%' : ''}`
      },
    })
    return () => controls.stop()
  }, [inView, target, sign, isPct])

  return <span ref={ref}>{`${sign}0${isPct ? '%' : ''}`}</span>
}

function Sparkline({ data, w = 88, h = 30 }) {
  const id = useId().replace(/:/g, '')
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pad = 3

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (d - min) / range) * (h - pad * 2)
    return [x, y]
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const fillPath = `${linePath} L ${pts[pts.length - 1][0]} ${h - pad} L ${pts[0][0]} ${h - pad} Z`
  const last = pts[pts.length - 1]

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff8a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#00ff8a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${id})`} />
      <path d={linePath} fill="none" stroke="#00ff8a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="#00ff8a" />
      <circle cx={last[0]} cy={last[1]} r="5" fill="#00ff8a" opacity="0.18" />
    </svg>
  )
}

function MockProof() {
  return (
    <div className="mock mock--proof">
      <div className="mock-proof-row">
        <span className="mock-proof-k">EVENTO</span>
        <span className="mock-proof-v">Real Madrid · Barcelona</span>
      </div>
      <div className="mock-proof-row">
        <span className="mock-proof-k">PICK</span>
        <span className="mock-proof-v"><b>Real Madrid -1.5</b> @ 2.10</span>
      </div>
      <div className="mock-proof-row">
        <span className="mock-proof-k">STAKE</span>
        <span className="mock-proof-v">50 €</span>
      </div>
      <div className="mock-proof-divider" />
      <div className="mock-proof-hash">
        <code>0xa9c3f2e8b1d4…</code>
        <span className="mock-proof-badge">BLOQUEADA</span>
      </div>
    </div>
  )
}

function MockRanking() {
  const rows = [
    { rank: 1, name: 'MarcGol', val: '+41%' },
    { rank: 2, name: 'SportRoi', val: '+38%' },
    { rank: 3, name: 'BetKing', val: '+29%' },
  ]
  return (
    <div className="mock mock--ranking">
      {rows.map(r => (
        <div className="mock-rank-row" key={r.rank}>
          <span className="mock-rank-num">#{r.rank}</span>
          <span className="mock-rank-name">{r.name}</span>
          <span className="mock-rank-val">{r.val}</span>
        </div>
      ))}
    </div>
  )
}

function MockVIP() {
  return (
    <div className="mock mock--vip">
      <div className="mock-vip-tier">
        <span className="mock-vip-tag">VIP</span>
        <div className="mock-vip-price">€9<span>/mes</span></div>
        <div className="mock-vip-line">Picks privados diarios</div>
        <div className="mock-vip-line">Análisis previo a cuotas</div>
      </div>
    </div>
  )
}

function MockChat() {
  return (
    <div className="mock mock--chat">
      <div className="mock-chat-bubble in">
        <b>MG</b> <span>Pick en 5 min, ojo a esta cuota</span>
      </div>
      <div className="mock-chat-bubble out">
        <b>tu</b> <span>¿Stake máximo?</span>
      </div>
      <div className="mock-chat-typing">
        <span/><span/><span/>
      </div>
    </div>
  )
}

function MockStats() {
  return (
    <div className="mock mock--stats">
      <div className="mock-stats-head">
        <span>ROI · 30 días</span>
        <span className="mock-stats-val">+24,3%</span>
      </div>
      <Sparkline data={[2,5,3,8,12,10,16,15,21,19,24,28]} w={210} h={56} />
    </div>
  )
}

function MockCategories() {
  return (
    <div className="mock mock--cats">
      {SPORTS.map((s, i) => (
        <span key={s} className={`cat-pill${i === 0 ? ' is-active' : ''}`}>{s}</span>
      ))}
    </div>
  )
}

const MOCKS = [MockProof, MockRanking, MockVIP, MockChat, MockStats, MockCategories]

function TipsterRain() {
  return (
    <div className="rain" aria-hidden="true">
      {RAIN_ITEMS.map((it, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{
            left: `${it.left}%`,
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
            fontSize: `${11 + it.depth * 5}px`,
            opacity: 0.1 + it.depth * 0.3,
          }}
        >
          <span className="rain-drop-name">{it.name}</span>
          <span className="rain-drop-val">{it.val}</span>
        </span>
      ))}
    </div>
  )
}

function Hero({ navigate }) {
  const ref = useRef(null)

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <section className="hero" ref={ref} onMouseMove={onMove}>
      <TipsterRain />
      <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        Las mejores apuestas,<br />
        <em>con track record real</em>
      </motion.h1>

      <motion.p className="hero-sub" variants={fadeUp} initial="hidden" animate="visible" custom={1}>
        Sigue a tipsters verificados, compara su historial auditado y toma decisiones inteligentes.
      </motion.p>

      <motion.div className="hero-btns" variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        <Button onClick={() => navigate('register')}>Explorar tipsters</Button>
        <Button variant="ghost" onClick={() => navigate('register')}>¿Eres tipster?</Button>
      </motion.div>

      <motion.div
        className="hero-scroll"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <div className="hero-scroll-arrow" />
      </motion.div>
    </section>
  )
}

function NavLinks() {
  const handleClick = (e, link) => {
    e.preventDefault()
    const id = NAV_SCROLL[link]
    if (id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  return (
    <nav className="nav-links">
      {NAV_LINKS.map(l => (
        <a key={l} href="#" className="nav-link" onClick={(e) => handleClick(e, l)}>{l}</a>
      ))}
    </nav>
  )
}

export default function Landing({ navigate, user }) {
  return (
    <div className="landing">

      <motion.nav
        className="nav"
        style={{ x: '-50%' }}
        initial={{ opacity: 0, y: -120, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          y: { type: 'spring', stiffness: 220, damping: 22, mass: 0.9, delay: 0.15 },
          opacity: { duration: 0.4, delay: 0.15 },
          scale: { type: 'spring', stiffness: 300, damping: 24, delay: 0.15 },
        }}
      >
        <div className="nav-logo">FindYour<span>Bet</span></div>
        <NavLinks />
        <div className="nav-btns">
          <Button variant="ghost" size="sm" onClick={() => navigate('login')}>Iniciar sesión</Button>
          <Button size="sm" onClick={() => navigate('register')}>Registrarse</Button>
        </div>
      </motion.nav>

      <Hero navigate={navigate} />

      <motion.div className="stats-bar" initial="hidden" animate="visible" variants={stagger}>
        {STATS.map((s, i) => (
          <motion.div key={i} className="stat-item" variants={fadeUp}>
            <div className="stat-num"><AnimatedNum value={s.num} /></div>
            <div className="stat-label">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      <section className="features-section" id="section-features">
        <div className="features-inner">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="section-title">Todo lo que necesitas<br />para apostar con cabeza</div>
          </motion.div>

          <motion.div
            className="features-bento"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            {FEATURES.map((f, i) => {
              const Mock = MOCKS[i]
              return (
                <motion.div key={i} className="feature-card" variants={fadeUp}>
                  <div className="feature-card-content">
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                  <div className="feature-card-mock">
                    <Mock />
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      <section className="ranking-section" id="section-ranking">
        <div className="ranking-inner">

          {!user && (
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              style={{
                background: 'rgba(0,255,138,0.06)',
                border: '0.5px solid rgba(0,255,138,0.2)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 24px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
              <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                👁️ Estás viendo una <strong style={{ color: 'var(--color-text)' }}>preview</strong> — Regístrate gratis para ver el ranking completo
              </div>
              <button
                onClick={() => navigate('register')}
                style={{ background: 'var(--color-primary)', border: 'none', color: '#000', padding: '8px 18px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Registrarse gratis →
              </button>
            </motion.div>
          )}

          <motion.div className="ranking-header" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2>Top tipsters esta semana</h2>
            <a href="#">Ver ranking completo</a>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {TIPSTERS.map((t, i) => (
              <motion.div key={i} className="tipster-card" variants={fadeUp}>
                <div className="tipster-rank">{t.rank}</div>
                <div className="tipster-avatar">{t.initials}</div>
                <div className="tipster-info">
                  <div className="tipster-name">{t.name}</div>
                  <div className="tipster-sport">{t.sport}</div>
                </div>
                <div className="tipster-spark">
                  <Sparkline data={t.spark} />
                </div>
                <div className="tipster-stats">
                  {[
                    { val: t.roi,     label: 'ROI' },
                    { val: t.acierto, label: 'Acierto' },
                    { val: t.picks,   label: 'Picks' },
                  ].map((s, j) => (
                    <div key={j} className="tipster-stat">
                      <div className="tipster-stat-val">{s.val}</div>
                      <div className="tipster-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="cta-section" id="section-cta">
        <div className="cta-inner">
          <motion.div className="cta-content" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2>Empieza gratis hoy</h2>
            <p>Sin tarjeta de crédito. Accede al ranking completo y sigue a tipsters de forma gratuita.</p>
            <div className="cta-btns">
              <Button onClick={() => navigate('register')}>Crear cuenta gratis</Button>
              <Button variant="ghost" onClick={() => navigate('login')}>Ver tipsters</Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-cols">
          <div className="footer-col">
            <h4>Producto</h4>
            <a href="#">Tipsters</a>
            <a href="#">Ranking</a>
            <a href="#">Precios</a>
            <a href="#">Cómo funciona</a>
          </div>
          <div className="footer-col">
            <h4>Empresa</h4>
            <a href="#">Sobre nosotros</a>
            <a href="#">Contacto</a>
            <a href="#">Blog</a>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#">Términos</a>
            <a href="#">Privacidad</a>
            <a href="#">Cookies</a>
            <a href="#">Juego responsable</a>
          </div>
        </div>

        <div className="footer-wordmark">FindYour<em>Bet</em></div>

        <div className="footer-bottom">
          <span>© 2025 FindYourBet · Apuesta con responsabilidad</span>
          <span className="footer-bottom-tag">+18</span>
        </div>
      </footer>

    </div>
  )
}