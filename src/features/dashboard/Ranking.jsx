import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'
import { supabase } from '../../lib/supabase'
import './dashboard.css'

const MEDALS = ['🥇', '🥈', '🥉']
const MIN_BETS = 10

const SPORTS_LIST = ['Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Fútbol Americano', 'eSports', 'MMA', 'Otros']

const PERIODS = [
  { id: 'trimestral', label: 'Ranking' },
  { id: 'setmanal',   label: 'Semanal' },
  { id: 'mensual',    label: 'Mensual' },
  { id: 'anual',      label: 'Anual' },
  { id: 'total',      label: 'Total' },
]

const TIER_STYLES = {
  elite:  { bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6', border: 'rgba(139,92,246,0.3)',  label: '💎 Elite'  },
  gold:   { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: '🥇 Gold'   },
  silver: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)', label: '🥈 Silver' },
  bronze: { bg: 'rgba(180,120,60,0.15)',  color: '#b4783c', border: 'rgba(180,120,60,0.3)',  label: '🥉 Bronze' },
}

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
  if (period === 'mensual') return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59) }
  if (period === 'anual') return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59) }
  if (period === 'trimestral') {
    const start = new Date(now)
    start.setMonth(now.getMonth() - 3)
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  return null
}

function calcYieldFromBets(bets) {
  const resolved = bets.filter(b => b.status !== 'pending')
  if (resolved.length < MIN_BETS) return null
  const { profit, stakeSum } = resolved.reduce(
    (acc, b) => ({
      stakeSum: acc.stakeSum + b.stake,
      profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
    }),
    { profit: 0, stakeSum: 0 }
  )
  return stakeSum > 0 ? (profit / stakeSum) * 100 : null
}

function getCombinations(arr) {
  const result = []
  for (let i = 1; i < (1 << arr.length); i++) {
    const combo = []
    for (let j = 0; j < arr.length; j++) {
      if (i & (1 << j)) combo.push(arr[j])
    }
    result.push(combo)
  }
  return result
}

function getBestCombination(userBets, selectedSports) {
  const validSports = selectedSports.filter(sport => {
    const sportBets = userBets.filter(b => b.sport === sport && b.status !== 'pending')
    return sportBets.length >= MIN_BETS
  })
  if (validSports.length === 0) return null
  const combos = getCombinations(validSports)
  let best = null
  for (const combo of combos) {
    const comboBets = userBets.filter(b => combo.includes(b.sport))
    const y = calcYieldFromBets(comboBets)
    if (y !== null && (best === null || y > best.yieldVal)) {
      best = { yieldVal: y, bets: comboBets }
    }
  }
  return best
}

function useRanking(period, selectedSports) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRanking = async () => {
    setLoading(true)
    const { data: bets, error } = await supabase
      .from('bets')
      .select('user_id, odds, stake, status, date, sport')
      .neq('status', 'pending')
    if (error || !bets) { setLoading(false); return }

    const range = getPeriodRange(period)
    const filteredBets = range
      ? bets.filter(b => { const d = new Date(b.date); return d >= range.start && d <= range.end })
      : bets

    const byUser = {}
    filteredBets.forEach(b => {
      if (!byUser[b.user_id]) byUser[b.user_id] = []
      byUser[b.user_id].push(b)
    })

    const isTodos = selectedSports.length === 0

    const entries = Object.entries(byUser)
      .map(([userId, userBets]) => {
        let finalBets
        if (isTodos) {
          const resolved = userBets.filter(b => b.status !== 'pending')
          if (resolved.length < MIN_BETS) return null
          finalBets = userBets
        } else {
          const best = getBestCombination(userBets, selectedSports)
          if (!best) return null
          finalBets = best.bets
        }

        const resolved = finalBets.filter(b => b.status !== 'pending')
        const won = finalBets.filter(b => b.status === 'won').length
        const lost = finalBets.filter(b => b.status === 'lost').length
        const yieldVal = calcYieldFromBets(finalBets)
        if (yieldVal === null) return null

        const avgOdds = finalBets.length > 0
          ? (finalBets.reduce((s, b) => s + b.odds, 0) / finalBets.length).toFixed(2)
          : '—'

        const tier = resolved.length >= 150 && yieldVal >= 15 ? 'elite'
          : resolved.length >= 80 && yieldVal >= 10 ? 'gold'
          : resolved.length >= 30 && yieldVal >= 5 ? 'silver'
          : 'bronze'

        return { userId, bets: resolved.length, won, lost, yieldVal, avgOdds, tier }
      })
      .filter(Boolean)
      .sort((a, b) => b.yieldVal - a.yieldVal)

    if (entries.length === 0) { setRanking([]); setLoading(false); return }

    const userIds = entries.map(e => e.userId)
    const { data: profiles } = await supabase
      .from('profiles').select('id, username').in('id', userIds)

    const profileMap = {}
    profiles?.forEach(p => { profileMap[p.id] = p.username })

    setRanking(entries.map(e => ({
      ...e,
      username: profileMap[e.userId] ? `@${profileMap[e.userId]}` : `@${e.userId.slice(0, 6)}`
    })))
    setLoading(false)
  }

  useEffect(() => {
    fetchRanking()
    const interval = setInterval(fetchRanking, 10000)
    return () => clearInterval(interval)
  }, [period, JSON.stringify(selectedSports)])

  return { ranking, loading }
}

function PeriodDropdown({ period, setPeriod }) {
  const [open, setOpen] = useState(false)
  const selected = PERIODS.find(p => p.id === period)
  const isRanking = period === 'trimestral'

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          background: isRanking ? 'var(--color-primary-light)' : 'var(--color-bg-soft)',
          border: isRanking ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-border)',
          color: isRanking ? 'var(--color-primary)' : 'var(--color-text)',
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700,
          padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px', justifyContent: 'space-between'
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isRanking && <span style={{ fontSize: '12px' }}>🏆</span>}
          {selected?.label}
        </span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ position: 'absolute', top: '48px', left: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', zIndex: 10, minWidth: '200px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>

              {/* Opció principal */}
              <div onClick={() => { setPeriod('trimestral'); setOpen(false) }}
                style={{ padding: '12px 16px', cursor: 'pointer', background: period === 'trimestral' ? 'var(--color-primary-light)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>🏆</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>Ranking</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Últimos 3 meses · Principal</div>
                  </div>
                  {period === 'trimestral' && (
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-primary)' }}>✓</span>
                  )}
                </div>
              </div>

              {/* Separador */}
              <div style={{ padding: '6px 16px 2px', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Por período
              </div>

              {/* Resta d'opcions */}
              {PERIODS.slice(1).map(p => (
                <div key={p.id} onClick={() => { setPeriod(p.id); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer', background: period === p.id ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                  <span style={{ fontSize: '13px', color: period === p.id ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: period === p.id ? 600 : 400 }}>{p.label}</span>
                  {period === p.id && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>✓</span>}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function SportDropdown({ selectedSports, toggleSport, onSelectAll, isTodos }) {
  const [open, setOpen] = useState(false)

  const label = isTodos
    ? 'Todos los deportes'
    : selectedSports.length === 1
      ? selectedSports[0]
      : `${selectedSports.length} deportes`

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ position: 'absolute', top: '48px', left: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', zIndex: 10, minWidth: '220px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>

              <div onClick={onSelectAll}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', borderBottom: '0.5px solid var(--color-border)', background: isTodos ? 'var(--color-primary-light)' : 'transparent' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isTodos ? 'var(--color-primary)' : 'var(--color-border)'}`, background: isTodos ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isTodos && <span style={{ color: '#010906', fontSize: '10px', fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: '14px', fontWeight: isTodos ? 700 : 400, color: isTodos ? 'var(--color-primary)' : 'var(--color-text)' }}>Todos</span>
              </div>

              {SPORTS_LIST.map(sport => {
                const active = selectedSports.includes(sport)
                return (
                  <div key={sport} onClick={() => toggleSport(sport)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: active ? 'var(--color-primary-light)' : 'transparent' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <span style={{ color: '#010906', fontSize: '10px', fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: active ? 700 : 400, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{sport}</span>
                  </div>
                )
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Ranking({ user }) {
  const [period, setPeriod] = useState('trimestral')
  const [selectedSports, setSelectedSports] = useState([])
  const { ranking, loading } = useRanking(period, selectedSports)

  const toggleSport = (sport) => {
    setSelectedSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    )
  }

  const periodLabel = PERIODS.find(p => p.id === period)?.label
  const isTodos = selectedSports.length === 0

  return (
    <motion.div key="ranking"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Ranking</h2>
        <p>Clasificación por Yield. Mínimo {MIN_BETS} apuestas resueltas para aparecer.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <PeriodDropdown period={period} setPeriod={setPeriod} />
        <SportDropdown
          selectedSports={selectedSports}
          toggleSport={toggleSport}
          onSelectAll={() => setSelectedSports([])}
          isTodos={isTodos}
        />
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Mostrando: <strong style={{ color: 'var(--color-text)' }}>{periodLabel}</strong>
        {!isTodos && <> · <strong style={{ color: 'var(--color-primary)' }}>{selectedSports.join(' + ')}</strong></>}
        {!isTodos && <span style={{ marginLeft: '6px' }}>— mejor combinación con mín. {MIN_BETS} apuestas por deporte</span>}
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div>Cargando ranking...</div>
        </div>
      ) : ranking.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <div className="empty-title">Sin datos para este filtro</div>
          <div className="empty-sub">Prueba con otro período o deporte.</div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div className="ranking-list" initial="hidden" animate="visible" variants={stagger}>
            {ranking.map((t, i) => {
              const tier = TIER_STYLES[t.tier]
              return (
                <motion.div key={t.userId} className="ranking-item" variants={fadeUp}
                  layout whileHover={{ x: 4, transition: { duration: 0.2 } }}>

                  <div className={`rank-pos ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>
                    {i < 3 ? MEDALS[i] : `#${i + 1}`}
                  </div>

                  <div className="tipster-info-rank">
                    <div className="tipster-name-rank" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {t.username}
                      {user?.id === t.userId && (
                        <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>
                          Tu
                        </span>
                      )}
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700, background: tier.bg, color: tier.color, border: `0.5px solid ${tier.border}` }}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="tipster-user-rank">{t.bets} apuestas resueltas</div>
                  </div>

                  <div className="rank-metric">
                    <div className={`rank-metric-val ${t.yieldVal >= 0 ? '' : 'red'}`}>
                      {t.yieldVal >= 0 ? '+' : ''}{t.yieldVal.toFixed(1)}%
                    </div>
                    <div className="rank-metric-label">Yield</div>
                  </div>

                  <div className="rank-metric">
                    <div className="rank-metric-val neutral">{t.won}/{t.lost}</div>
                    <div className="rank-metric-label">W/L</div>
                  </div>

                  <div className="rank-metric">
                    <div className="rank-metric-val neutral">{t.avgOdds}</div>
                    <div className="rank-metric-label">Cuota media</div>
                  </div>

                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  )
}