import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'

const PERIODS = [
  { id: 'setmanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'anual', label: 'Anual' },
  { id: 'total', label: 'Total' },
  { id: 'trimestral', label: 'Ranking' },
]

function buildChartData(bets, period) {
  const resolved = bets.filter(b => b.status !== 'pending')
  if (resolved.length === 0) return []

  const grouped = {}
  resolved.forEach(b => {
    const date = new Date(b.date)
    let key

    if (period === 'setmanal' || period === 'mensual' || period === 'trimestral') {
      key = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    } else {
      key = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    }

    if (!grouped[key]) grouped[key] = { profit: 0, date }
    const profit = b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake
    grouped[key].profit += profit
  })

  return Object.entries(grouped)
    .sort((a, b) => a[1].date - b[1].date)
    .map(([label, { profit }]) => ({ label, profit: parseFloat(profit.toFixed(2)) }))
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => Math.abs(d.profit)), 1)
  const height = 180

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${height + 24}px`, paddingBottom: '24px', overflowX: 'auto' }}>
      {data.map((d, i) => {
        const barH = (Math.abs(d.profit) / max) * height
        const isPos = d.profit >= 0
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '40px', flex: '1 0 40px' }}>
            <div style={{ fontSize: '10px', color: isPos ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 600 }}>
              {isPos ? '+' : ''}{d.profit}
            </div>
            <div style={{ width: '100%', height: `${barH}px`, background: isPos ? 'var(--color-primary)' : 'var(--color-error)', borderRadius: '4px 4px 0 0', opacity: 0.85, minHeight: '4px', transition: 'height 0.4s ease' }} />
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ data }) {
  const w = 600
  const h = 180
  const pad = { top: 16, right: 16, bottom: 24, left: 40 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  if (data.length < 2) return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>Necesitas más datos para ver la línea</div>

  const profits = data.map(d => d.profit)
  const min = Math.min(...profits)
  const max = Math.max(...profits)
  const range = max - min || 1

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * innerW,
    y: pad.top + (1 - (d.profit - min) / range) * innerH,
    ...d
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${h - pad.bottom} L ${pts[0].x} ${h - pad.bottom} Z`

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ minWidth: '300px' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i}
            x1={pad.left} y1={pad.top + t * innerH}
            x2={pad.left + innerW} y2={pad.top + t * innerH}
            stroke="var(--color-border)" strokeWidth="0.5" />
        ))}
        <path d={fillPath} fill="url(#lineGrad)" />
        <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="var(--color-primary)" />
            <text x={p.x} y={h - 6} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function Estadisticas({ bets, loadingBets, won, lost, yieldVal, avgOdds, onNewBet, period, onPeriodChange }) {
  const [chartType, setChartType] = useState('line')

  const chartData = useMemo(() => buildChartData(bets, period), [bets, period])

  const KPIs = [
    { label: 'Yield', value: `${yieldVal.toFixed(2)}%`, colorClass: yieldVal >= 0 ? 'green' : 'red', sub: 'Beneficio sobre lo apostado' },
    { label: 'W / L', value: `${won.length} / ${lost.length}`, colorClass: '', sub: 'Ganadas / Perdidas' },
    { label: 'Total Apuestas', value: bets.length, colorClass: '', sub: 'Historial completo' },
    { label: 'Cuota Media', value: avgOdds, colorClass: 'yellow', sub: 'Promedio de cuotas' },
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

      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Beneficio por período</div>
          <select value={chartType} onChange={e => setChartType(e.target.value)}
            style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '7px 12px', borderRadius: 'var(--radius-md)', outline: 'none', cursor: 'pointer' }}>
            <option value="line">↗ Línea</option>
            <option value="bars">▦ Barras</option>
          </select>
        </div>

        {loadingBets ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
            <div>Sin datos para este período</div>
          </div>
        ) : chartType === 'bars' ? (
          <BarChart data={chartData} />
        ) : (
          <LineChart data={chartData} />
        )}
      </div>

    </motion.div>
  )
}