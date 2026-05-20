import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { hasMatchStarted } from './hooks/useBets'
import PostModal from './feed/PostModal'
import './dashboard.css'

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Fútbol Americano', 'eSports', 'MMA', 'Otros']
const MARKETS = ['1X2', 'Hándicap', 'Over/Under', 'Ambos marcan', 'Otro']

const PERIODS = [
  { id: 'activas',    label: 'Activas' },
  { id: 'trimestral', label: 'Ranking' },
  { id: 'total',      label: 'Total' },
  { id: 'anual',      label: 'Anual' },
  { id: 'mensual',    label: 'Mensual' },
  { id: 'setmanal',   label: 'Semanal' },
]

const NAVIGABLE = ['setmanal', 'mensual', 'anual']

const STATUS_CONFIG = {
  won:     { label: 'Ganada',    accent: 'var(--color-primary)',    bg: 'var(--color-primary-light)', border: 'var(--color-primary-border)' },
  lost:    { label: 'Perdida',   accent: 'var(--color-error)',      bg: 'var(--color-error-light)',   border: 'var(--color-error-border)' },
  pending: { label: 'Pendiente', accent: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)',       border: 'var(--color-border)' },
}

// ── Helpers de filtratge ──────────────────────────────────────────────────────

function getPeriodRange(period, offset) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (period === 'setmanal') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - day - offset * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    return { start: monday, end: sunday }
  }
  if (period === 'mensual') {
    const m = month - offset
    return { start: new Date(year, m, 1, 0, 0, 0), end: new Date(year, m + 1, 0, 23, 59, 59) }
  }
  if (period === 'anual') {
    const y = year - offset
    return { start: new Date(y, 0, 1, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59) }
  }
  if (period === 'trimestral') {
    const from = new Date(now)
    from.setMonth(now.getMonth() - 3)
    from.setHours(0, 0, 0, 0)
    return { start: from, end: now }
  }
  return null
}

function getPeriodLabel(period, offset) {
  if (!NAVIGABLE.includes(period)) return null
  const now = new Date()
  if (period === 'setmanal') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - day - offset * 7)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = d => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    const tag = offset === 0 ? 'Semana actual' : offset === 1 ? 'Semana pasada' : `Hace ${offset} semanas`
    return `${tag} · ${fmt(monday)} – ${fmt(sunday)}`
  }
  if (period === 'mensual') {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const s = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  if (period === 'anual') return String(now.getFullYear() - offset)
  return null
}

function filterBets(allBets, period, offset) {
  if (period === 'activas') return allBets.filter(b => b.status === 'pending')
  if (period === 'total') return allBets
  const range = getPeriodRange(period, offset)
  if (!range) return allBets
  return allBets.filter(b => {
    const d = new Date(b.date)
    return d >= range.start && d <= range.end
  })
}

function calcStats(bets) {
  const resolved = bets.filter(b => b.status !== 'pending')
  const won = bets.filter(b => b.status === 'won')
  const lost = bets.filter(b => b.status === 'lost')
  let yieldVal = 0
  if (resolved.length > 0) {
    const { profit, stakeSum } = resolved.reduce(
      (acc, b) => ({ stakeSum: acc.stakeSum + b.stake, profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake) }),
      { profit: 0, stakeSum: 0 }
    )
    yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
  }
  const avgOdds = bets.length > 0
    ? (bets.reduce((s, b) => s + b.odds, 0) / bets.length).toFixed(2)
    : '—'
  return { won, lost, yieldVal, avgOdds }
}

// ── Stats del panell dret ─────────────────────────────────────────────────────

function calcStreaks(allBets) {
  const resolved = [...allBets]
    .filter(b => b.status !== 'pending')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (!resolved.length) return { best: 0, current: 0, currentType: null }

  let best = 0, cur = 0, curType = null
  for (const b of resolved) {
    if (b.status === curType) cur++
    else { curType = b.status; cur = 1 }
    if (b.status === 'won') best = Math.max(best, cur)
  }

  // racha actual (des del final cap enrere)
  const last = resolved[resolved.length - 1].status
  let currentStreak = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i].status === last) currentStreak++
    else break
  }
  return { best, current: currentStreak, currentType: last }
}

function getTopBets(allBets) {
  return [...allBets]
    .filter(b => b.status === 'won')
    .map(b => ({ ...b, profit: +(b.stake * (b.odds - 1)).toFixed(2) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3)
}

function getStatsBySport(allBets) {
  const resolved = allBets.filter(b => b.status !== 'pending')
  const map = {}
  for (const b of resolved) {
    if (!map[b.sport]) map[b.sport] = { won: 0, total: 0, profit: 0, stake: 0 }
    map[b.sport].total++
    if (b.status === 'won') { map[b.sport].won++; map[b.sport].profit += b.stake * (b.odds - 1) }
    else map[b.sport].profit -= b.stake
    map[b.sport].stake += b.stake
  }
  return Object.entries(map)
    .map(([sport, s]) => ({
      sport,
      winRate: (s.won / s.total) * 100,
      total: s.total,
      yieldVal: s.stake > 0 ? (s.profit / s.stake) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

function getRecentForm(allBets, n = 16) {
  return [...allBets]
    .filter(b => b.status !== 'pending')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, n)
    .reverse()
}

// ── Panell dret ───────────────────────────────────────────────────────────────

function StatSection({ title, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '0.5px solid var(--color-border)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function StatsPanel({ allBets }) {
  const resolved = allBets.filter(b => b.status !== 'pending')
  const { best, current, currentType } = useMemo(() => calcStreaks(allBets), [allBets])
  const topBets = useMemo(() => getTopBets(allBets), [allBets])
  const sportStats = useMemo(() => getStatsBySport(allBets), [allBets])
  const recentForm = useMemo(() => getRecentForm(allBets), [allBets])
  const maxOddsWon = useMemo(() => [...allBets].filter(b => b.status === 'won').sort((a, b) => b.odds - a.odds)[0], [allBets])
  const longestOddsLost = useMemo(() => [...allBets].filter(b => b.status === 'lost').sort((a, b) => b.stake - a.stake)[0], [allBets])

  if (resolved.length === 0) return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Las estadísticas aparecerán cuando tengas apuestas resueltas.</div>
    </div>
  )

  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', position: 'sticky', top: '20px' }}>

      {/* Forma recent */}
      {recentForm.length > 0 && (
        <StatSection title="⚡ Forma reciente">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '6px' }}>
            {recentForm.map((b, i) => (
              <div key={i} title={b.event}
                style={{ height: '44px', borderRadius: '8px', background: b.status === 'won' ? 'var(--color-primary)' : 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: b.status === 'won' ? '#010906' : '#fff', cursor: 'default' }}>
                {b.status === 'won' ? 'W' : 'L'}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
            Últimas {recentForm.length} apuestas · más antigua → más reciente
          </div>
        </StatSection>
      )}

      {/* Rachas */}
      <StatSection title="🔥 Rachas">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '0.5px solid var(--color-border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Mejor racha</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)' }}>{best}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>victorias seguidas</div>
          </div>
          <div style={{ background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: `0.5px solid ${currentType === 'won' ? 'var(--color-primary-border)' : currentType === 'lost' ? 'var(--color-error-border)' : 'var(--color-border)'}` }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Racha actual</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: currentType === 'won' ? 'var(--color-primary)' : currentType === 'lost' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{current}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentType === 'won' ? 'ganando' : currentType === 'lost' ? 'perdiendo' : '—'}</div>
          </div>
        </div>
      </StatSection>

      {/* Hazañas */}
      {(maxOddsWon || longestOddsLost) && (
        <StatSection title="🏅 Hazañas">
          {maxOddsWon && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: longestOddsLost ? '0.5px solid var(--color-border)' : 'none' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{maxOddsWon.event}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mayor cuota ganada</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{parseFloat(maxOddsWon.odds).toFixed(2)}</div>
            </div>
          )}
          {longestOddsLost && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{longestOddsLost.event}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mayor stake arriesgado</div>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-error)', flexShrink: 0 }}>{longestOddsLost.stake}</div>
            </div>
          )}
        </StatSection>
      )}

      {/* Top apostes */}
      {topBets.length > 0 && (
        <StatSection title="💎 Mejores apuestas">
          {topBets.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < topBets.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.event}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>@{parseFloat(b.odds).toFixed(2)} · {b.stake}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>+{b.profit.toFixed(1)}</div>
            </div>
          ))}
        </StatSection>
      )}

      {/* Per sport */}
      {sportStats.length > 0 && (
        <StatSection title="⚽ Por deporte">
          {sportStats.map(s => (
            <div key={s.sport} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{s.sport}</span>
                <span style={{ fontSize: '11px', color: s.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)', fontWeight: 700 }}>
                  {s.yieldVal >= 0 ? '+' : ''}{s.yieldVal.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '4px', background: 'var(--color-bg-soft)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.winRate}%`, background: s.winRate >= 50 ? 'var(--color-primary)' : 'var(--color-error)', borderRadius: '2px', transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {s.winRate.toFixed(0)}% win · {s.total} apuesta{s.total !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </StatSection>
      )}

    </div>
  )
}

// ── Modal d'edició ────────────────────────────────────────────────────────────

const inputSt = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
const selectSt = { ...inputSt, cursor: 'pointer' }
const labelSt = { fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }

function EditBetModal({ bet, onSave, onClose }) {
  const [form, setForm] = useState({ event: bet.event || '', pick: bet.pick || '', odds: bet.odds || '', stake: bet.stake || 5, sport: bet.sport || 'Fútbol', market: bet.market || '1X2', date: bet.date ? bet.date.slice(0, 16) : '', analysis: bet.analysis || '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.event || !form.pick || !form.odds || !form.date) return
    setSaving(true)
    await onSave(bet.id, { ...form, odds: parseFloat(form.odds), stake: Number(form.stake) })
    setSaving(false)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>Editar apuesta</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={labelSt}>Evento *</label><input style={inputSt} value={form.event} onChange={e => set('event', e.target.value)} placeholder="ej. Real Madrid vs Barcelona" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={labelSt}>Pick *</label><input style={inputSt} value={form.pick} onChange={e => set('pick', e.target.value)} /></div>
            <div><label style={labelSt}>Cuota *</label><input style={inputSt} type="number" step="0.01" min="1" value={form.odds} onChange={e => set('odds', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={labelSt}>Sport</label><select style={selectSt} value={form.sport} onChange={e => set('sport', e.target.value)}>{SPORTS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={labelSt}>Mercado</label><select style={selectSt} value={form.market} onChange={e => set('market', e.target.value)}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={labelSt}>Stake</label><input style={inputSt} type="number" min="1" max="10" value={form.stake} onChange={e => set('stake', e.target.value)} /></div>
            <div><label style={labelSt}>Fecha y hora *</label><input style={inputSt} type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          </div>
          <div><label style={labelSt}>Análisis (opcional)</label><textarea style={{ ...inputSt, resize: 'vertical', minHeight: '70px' }} value={form.analysis} onChange={e => set('analysis', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <Button onClick={handleSave} disabled={saving || !form.event || !form.pick || !form.odds || !form.date}>{saving ? 'Guardando...' : '✓ Guardar cambios'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Carta d'aposta ────────────────────────────────────────────────────────────

function BetCard({ b, onResolveBet, onDeleteBet, onEditBet, onViewPost }) {
  const started = hasMatchStarted(b)
  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending
  const isLive = b.status === 'pending' && started
  const canEdit = b.status === 'pending' && !started

  const dateStr = new Date(b.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }}
      style={{ display: 'flex', background: 'var(--color-bg)', border: `0.5px solid ${isLive ? 'var(--color-warning)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', minWidth: 0, cursor: 'pointer' }}
      whileHover={{ boxShadow: 'var(--shadow-sm)' }}
      onClick={() => onViewPost(b.id)}>
      <div style={{ width: '3px', flexShrink: 0, background: isLive ? 'var(--color-warning)' : cfg.accent }} />
      <div style={{ flex: 1, padding: '14px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Badge */}
        <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 700, background: isLive ? 'rgba(245,158,11,0.12)' : cfg.bg, color: isLive ? 'var(--color-warning)' : cfg.accent, border: `0.5px solid ${isLive ? 'rgba(245,158,11,0.3)' : cfg.border}` }}>
          {isLive ? '🔴 En curso' : cfg.label}
        </span>

        {/* Títol */}
        <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.4, wordBreak: 'break-word' }}>{b.event}</div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {[b.sport, b.market].filter(Boolean).map((tag, i) => (
            <span key={i} style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{tag}</span>
          ))}
          {b.pick && <span style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{b.pick}</span>}
        </div>

        {/* Métricas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[{ label: 'Cuota', value: parseFloat(b.odds).toFixed(2), big: true }, { label: 'Stake', value: `${b.stake}`, big: true }, { label: 'Fecha', value: dateStr, big: false }].map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</span>
              <span style={{ fontWeight: s.big ? 700 : 400, fontSize: s.big ? '13px' : '11px', color: s.big ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Botons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: 'auto' }}>
          {canEdit && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <motion.button whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onEditBet(b) }} style={{ flex: 1, background: 'var(--color-bg-soft)', color: 'var(--color-text)', border: '0.5px solid var(--color-border)', padding: '6px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>✏️ Editar</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onDeleteBet(b.id) }} style={{ flex: 1, background: 'var(--color-error-light)', color: 'var(--color-error)', border: '0.5px solid var(--color-error-border)', padding: '6px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>🗑 Borrar</motion.button>
            </div>
          )}
          {b.status === 'pending' && started && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <motion.button whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onResolveBet(b.id, 'won') }} style={{ flex: 1, background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '7px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>✓ Win</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onResolveBet(b.id, 'lost') }} style={{ flex: 1, background: 'var(--color-error)', color: '#fff', border: 'none', padding: '7px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>✗ Loss</motion.button>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  )
}

// ── Component principal ───────────────────────────────────────────────────────

export default function MisApuestas({ bets: allBets, loadingBets, onNewBet, onResolveBet, onDeleteBet, onUpdateBet, user }) {
  const [period, setPeriod] = useState('trimestral')
  const [offset, setOffset] = useState(0)
  const [editingBet, setEditingBet] = useState(null)
  const [postModalBetId, setPostModalBetId] = useState(null)

  const handlePeriodChange = (p) => { setPeriod(p); setOffset(0) }

  const bets = useMemo(() => filterBets(allBets, period, offset), [allBets, period, offset])
  const { won, lost, yieldVal, avgOdds } = useMemo(() => calcStats(bets), [bets])
  const periodLabel = getPeriodLabel(period, offset)
  const isNavigable = NAVIGABLE.includes(period)
  const activeCount = useMemo(() => allBets.filter(b => b.status === 'pending').length, [allBets])

  const navBtn = (disabled, onClick, label) => (
    <button onClick={onClick} disabled={disabled}
      style={{ background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '4px 12px', cursor: disabled ? 'default' : 'pointer', fontSize: '16px', color: disabled ? 'var(--color-border)' : 'var(--color-text)', fontFamily: 'var(--font-sans)', lineHeight: 1 }}>
      {label}
    </button>
  )

  return (
    <motion.div key="apuestas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      {/* Layout dues columnes — engloba des del títol */}
      <div className="historial-layout">

        {/* Columna esquerra */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '2px' }}>Historial de Apuestas</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Una vez empieza el partido, no se pueden modificar.</p>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '14px' }}>
            {[
              { label: 'Yield', value: `${yieldVal.toFixed(1)}%`, color: yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' },
              { label: 'Ganadas', value: won.length, color: 'var(--color-primary)' },
              { label: 'Perdidas', value: lost.length, color: 'var(--color-error)' },
              { label: 'Total', value: bets.length, color: 'var(--color-text)' },
              { label: 'Cuota med.', value: avgOdds, color: 'var(--color-warning)' },
            ].map(k => (
              <div key={k.label} style={{ padding: '8px 10px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '3px', fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Pills períodes */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px', marginBottom: '8px' }}>
            {PERIODS.filter(p => p.id !== 'activas').map(p => (
              <button key={p.id} onClick={() => handlePeriodChange(p.id)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: period === p.id ? 'var(--color-primary)' : 'transparent', color: period === p.id ? '#010906' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Navegació temporal */}
          {isNavigable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '6px 10px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              {navBtn(false, () => setOffset(o => o + 1), '←')}
              <span style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>{periodLabel}</span>
              {navBtn(offset === 0, () => setOffset(o => o - 1), '→')}
            </div>
          )}

          {/* Activas + Nova aposta apilades */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => handlePeriodChange('activas')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: 'var(--radius-lg)', border: period === 'activas' ? 'none' : '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: period === 'activas' ? 'var(--color-primary)' : 'var(--color-bg)', color: period === 'activas' ? '#010906' : 'var(--color-text-muted)', alignSelf: 'flex-start' }}>
              Activas
              {activeCount > 0 && (
                <span style={{ fontSize: '9px', background: period === 'activas' ? 'rgba(0,0,0,0.15)' : 'var(--color-primary-light)', color: period === 'activas' ? '#010906' : 'var(--color-primary)', borderRadius: 'var(--radius-full)', padding: '1px 5px', fontWeight: 700 }}>
                  {activeCount}
                </span>
              )}
            </button>
            <Button size="sm" onClick={onNewBet} style={{ alignSelf: 'flex-start' }}>+ Nueva apuesta</Button>
          </div>

          {/* Cartes */}
          {loadingBets ? (
            <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando apuestas...</div></div>
          ) : bets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{period === 'activas' ? '✅' : '📋'}</div>
              <div className="empty-title">{period === 'activas' ? 'Sin apuestas activas' : 'Sin apuestas en este período'}</div>
              <div className="empty-sub">{period === 'activas' ? 'Todas tus apuestas ya han sido resueltas.' : 'No hay apuestas registradas para el período seleccionado.'}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <AnimatePresence>
                {bets.map(b => (
                  <BetCard key={b.id} b={b} onResolveBet={onResolveBet} onDeleteBet={onDeleteBet} onEditBet={setEditingBet} onViewPost={setPostModalBetId} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Columna dreta: stats */}
        <StatsPanel allBets={allBets} />
      </div>

      <AnimatePresence>
        {editingBet && (
          <EditBetModal bet={editingBet} onSave={onUpdateBet} onClose={() => setEditingBet(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {postModalBetId && user && (
          <PostModal betId={postModalBetId} currentUser={user} onClose={() => setPostModalBetId(null)} />
        )}
      </AnimatePresence>

    </motion.div>
  )
}
