import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'

const PERIODS = [
  { id: 'setmanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'anual', label: 'Anual' },
  { id: 'total', label: 'Total' },
  { id: 'trimestral', label: 'Ranking' },
]

const INITIAL_BANK = 1000

function getPeriodRange(period) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (period === 'setmanal') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - day)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { start: monday, end: sunday }
  }
  if (period === 'mensual') return { start: new Date(year, month, 1, 0, 0, 0), end: new Date(year, month + 1, 0, 23, 59, 59) }
  if (period === 'anual') return { start: new Date(year, 0, 1, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59) }
  if (period === 'trimestral') {
    const threeMonthsAgo = new Date(now)
    threeMonthsAgo.setMonth(now.getMonth() - 3)
    threeMonthsAgo.setHours(0, 0, 0, 0)
    return { start: threeMonthsAgo, end: now }
  }
  return null
}

function buildBankData(allBets, period) {
  const sorted = [...allBets]
    // Només won/lost. 'void' (nul, diners retornats) no compta a estadístiques.
    .filter(b => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  // Full bank (always all bets) — for the KPI cards
  let fullBank = INITIAL_BANK
  for (const b of sorted) {
    const stake = fullBank * 0.01
    fullBank = b.status === 'won'
      ? parseFloat((fullBank + stake * (b.odds - 1)).toFixed(2))
      : parseFloat((fullBank - stake).toFixed(2))
  }

  // Period slice — for the chart
  let periodBets = sorted
  let startBank = INITIAL_BANK
  if (period !== 'total') {
    const range = getPeriodRange(period)
    if (range) {
      const before = sorted.filter(b => new Date(b.date) < range.start)
      periodBets = sorted.filter(b => {
        const d = new Date(b.date)
        return d >= range.start && d <= range.end
      })
      for (const b of before) {
        const stake = startBank * 0.01
        startBank = b.status === 'won'
          ? parseFloat((startBank + stake * (b.odds - 1)).toFixed(2))
          : parseFloat((startBank - stake).toFixed(2))
      }
    }
  }

  const points = [{ label: 'Inicio', bank: startBank, event: null, status: null }]
  let bank = startBank
  for (const b of periodBets) {
    const stake = parseFloat((bank * 0.01).toFixed(2))
    bank = b.status === 'won'
      ? parseFloat((bank + stake * (b.odds - 1)).toFixed(2))
      : parseFloat((bank - stake).toFixed(2))
    const label = new Date(b.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    points.push({ label, bank, event: b.event, status: b.status })
  }

  return { points, startBank, finalBank: fullBank }
}

function fmtEur(val) {
  return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function BankLineChart({ points }) {
  const w = 600
  const h = 200
  const pad = { top: 20, right: 16, bottom: 28, left: 60 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  if (points.length < 2) return (
    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
      <div>Sin apuestas resueltas en este período</div>
    </div>
  )

  const values = points.map(p => p.bank)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = (rawMax - rawMin) * 0.15 || 50
  const min = rawMin - padding
  const max = rawMax + padding
  const range = max - min

  const toY = (v) => pad.top + (1 - (v - min) / range) * innerH
  const toX = (i) => pad.left + (i / (points.length - 1)) * innerW

  const pts = points.map((p, i) => ({ x: toX(i), y: toY(p.bank), ...p }))
  const baselineY = toY(points[0].bank)
  const finalAbove = points[points.length - 1].bank >= points[0].bank

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`

  const step = Math.max(1, Math.ceil(points.length / 7))
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => min + t * range)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ minWidth: '300px' }}>
        <defs>
          <linearGradient id="bankGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={finalAbove ? 'var(--color-primary)' : 'var(--color-error)'} stopOpacity="0.2" />
            <stop offset="100%" stopColor={finalAbove ? 'var(--color-primary)' : 'var(--color-error)'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <line key={i}
            x1={pad.left} y1={toY(v)}
            x2={pad.left + innerW} y2={toY(v)}
            stroke="var(--color-border)" strokeWidth="0.5" />
        ))}

        {yTicks.map((v, i) => (
          <text key={i} x={pad.left - 6} y={toY(v) + 4}
            textAnchor="end" fill="var(--color-text-muted)" fontSize="9">
            {v.toFixed(0)}
          </text>
        ))}

        {/* Línia de referència al bank inicial del període */}
        <line x1={pad.left} y1={baselineY} x2={pad.left + innerW} y2={baselineY}
          stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="5,4" opacity="0.4" />

        <path d={fillPath} fill="url(#bankGrad)" />
        <path d={linePath} fill="none"
          stroke={finalAbove ? 'var(--color-primary)' : 'var(--color-error)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3"
              fill={p.bank >= pts[0].bank ? 'var(--color-primary)' : 'var(--color-error)'} />
            {(i === 0 || i === pts.length - 1 || i % step === 0) && (
              <text x={p.x} y={h - 8} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

const PERIOD_CHART_LABEL = {
  setmanal: 'Beneficio semanal',
  mensual: 'Beneficio mensual',
  anual: 'Beneficio anual',
  total: 'Beneficio total',
  trimestral: 'Beneficio en Ranking',
}

export default function Estadisticas({ bets, allBets = [], loadingBets, won, lost, yieldVal, avgOdds, onNewBet, period, onPeriodChange, onNavigateToHistorial }) {
  const { points: bankPoints, finalBank } = useMemo(() => buildBankData(allBets, period), [allBets, period])

  const totalBenefit = parseFloat((finalBank - INITIAL_BANK).toFixed(2))

  // Total = won + lost (NO inclou pending ni void). Els nuls no compten enlloc.
  const totalCounted = won.length + lost.length

  const KPIs = [
    { label: 'Yield', value: `${yieldVal.toFixed(2)}%`, colorClass: yieldVal >= 0 ? 'green' : 'red', sub: 'Beneficio sobre lo apostado' },
    { label: 'W / L', value: `${won.length} / ${lost.length}`, colorClass: '', sub: 'Ganadas / Perdidas' },
    { label: 'Total Apuestas', value: totalCounted, colorClass: '', sub: 'Resueltas (sin nulas ni pendientes)' },
    { label: 'Cuota Media', value: avgOdds, colorClass: 'yellow', sub: 'Promedio de cuotas' },
    { label: 'BANK', value: fmtEur(finalBank), colorClass: finalBank >= INITIAL_BANK ? 'green' : 'red', sub: 'Capital acumulado' },
    { label: 'BENEFICIO', value: `${totalBenefit >= 0 ? '+' : ''}${fmtEur(totalBenefit)}`, colorClass: totalBenefit >= 0 ? 'green' : 'red', sub: 'Sobre el bank inicial: 1.000,00€' },
  ]

  return (
    <motion.div key="estadisticas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Estadísticas personales</h2>
          <p>Tu rendimiento como tipster en el período seleccionado.</p>
        </div>
        <button onClick={onNewBet}
          style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '10px 18px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
          + Nueva Apuesta
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <select value={period} onChange={e => onPeriodChange(e.target.value)}
          style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none', cursor: 'pointer', width: 'fit-content' }}>
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <AnimatePresence>
          {period === 'trimestral' && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              style={{ marginTop: '10px', padding: '10px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '420px' }}>
              💡 El modo <strong style={{ color: 'var(--color-text)' }}>Ranking</strong> refleja tu rendimiento de los últimos 3 meses.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div className="kpi-grid" initial="hidden" animate="visible" variants={stagger}>
        {KPIs.map((k, i) => (
          <motion.div key={i} className="kpi-card" variants={fadeUp} whileHover={{ y: -2, transition: { duration: 0.2 } }}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.colorClass}`}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* EVOLUCIÓ DEL BANK */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{PERIOD_CHART_LABEL[period] ?? 'Beneficio total'}</div>
          <button onClick={onNavigateToHistorial}
            style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            Ver historial →
          </button>
        </div>

        {loadingBets ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>
        ) : (
          <BankLineChart points={bankPoints} />
        )}
      </div>

    </motion.div>
  )
}
