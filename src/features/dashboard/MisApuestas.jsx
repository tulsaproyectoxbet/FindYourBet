import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { hasMatchStarted } from './hooks/useBets'
import './dashboard.css'

const PERIODS = [
  { id: 'setmanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'anual', label: 'Anual' },
  { id: 'total', label: 'Total' },
  { id: 'trimestral', label: 'Ranking' },
]

const STATUS_CONFIG = {
  won:     { label: 'Ganada',   accent: 'var(--color-primary)',  bg: 'var(--color-primary-light)',  border: 'var(--color-primary-border)' },
  lost:    { label: 'Perdida',  accent: 'var(--color-error)',    bg: 'var(--color-error-light)',    border: 'var(--color-error-border)' },
  pending: { label: 'Pendiente', accent: 'var(--color-text-muted)', bg: 'var(--color-bg-soft)', border: 'var(--color-border)' },
}

function BetCard({ b, onResolveBet, onDeleteBet }) {
  const started = hasMatchStarted(b)
  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending
  const isLive = b.status === 'pending' && started

  const dateStr = new Date(b.date).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }}
      style={{
        display: 'flex', background: 'var(--color-bg)',
        border: `0.5px solid ${isLive ? 'var(--color-warning)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* accent lateral */}
      <div style={{ width: '4px', flexShrink: 0, background: isLive ? 'var(--color-warning)' : cfg.accent }} />

      <div style={{ flex: 1, padding: '16px 20px' }}>
        {/* fila superior */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.3, flex: 1, marginRight: '10px' }}>{b.event}</div>
          <span style={{
            flexShrink: 0, padding: '3px 10px', borderRadius: 'var(--radius-full)',
            fontSize: '11px', fontWeight: 700,
            background: isLive ? 'rgba(245,158,11,0.12)' : cfg.bg,
            color: isLive ? 'var(--color-warning)' : cfg.accent,
            border: `0.5px solid ${isLive ? 'rgba(245,158,11,0.3)' : cfg.border}`,
          }}>
            {isLive ? '🔴 En curso' : cfg.label}
          </span>
        </div>

        {/* tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
          {[b.sport, b.market].filter(Boolean).map((tag, i) => (
            <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{tag}</span>
          ))}
          {b.pick && (
            <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{b.pick}</span>
          )}
        </div>

        {/* stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Cuota</div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{parseFloat(b.odds).toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Stake</div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>S{b.stake}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Fecha</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{dateStr}</div>
          </div>
        </div>

        {/* accions */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {b.status === 'pending' && !started && (
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
              onClick={() => onDeleteBet(b.id)}
              style={{ background: 'var(--color-error-light)', color: 'var(--color-error)', border: '0.5px solid var(--color-error-border)', padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              🗑 Borrar
            </motion.button>
          )}
          {b.status === 'pending' && started && (
            <>
              <motion.button className="btn-win" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={() => onResolveBet(b.id, 'won')}>✓ Win</motion.button>
              <motion.button className="btn-loss" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={() => onResolveBet(b.id, 'lost')}>✗ Loss</motion.button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function MisApuestas({ bets, loadingBets, won, lost, yieldVal, avgOdds, onNewBet, onResolveBet, onDeleteBet, period, onPeriodChange }) {
  return (
    <motion.div key="apuestas"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Historial de Apuestas</h2>
        <p>Tus apuestas registradas. Una vez empieza el partido, no se pueden modificar.</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[
          { label: 'Yield', value: `${yieldVal.toFixed(2)}%`, color: yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' },
          { label: 'Ganadas', value: won.length, color: 'var(--color-primary)' },
          { label: 'Perdidas', value: lost.length, color: 'var(--color-error)' },
          { label: 'Total', value: bets.length, color: 'var(--color-text)' },
          { label: 'Cuota media', value: avgOdds, color: 'var(--color-warning)' },
        ].map(k => (
          <div key={k.label} style={{
            padding: '12px 18px', background: 'var(--color-bg)',
            border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
            minWidth: '90px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Periode pills + botó nova aposta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => onPeriodChange(p.id)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                background: period === p.id ? 'var(--color-primary)' : 'transparent',
                color: period === p.id ? '#010906' : 'var(--color-text-muted)',
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onNewBet}>+ Nueva Apuesta</Button>
      </div>

      {/* Llista de cards */}
      {loadingBets ? (
        <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando apuestas...</div></div>
      ) : bets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Sin apuestas en este período</div>
          <div className="empty-sub">No hay apuestas registradas para el período seleccionado.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          <AnimatePresence>
            {bets.map(b => (
              <BetCard key={b.id} b={b} onResolveBet={onResolveBet} onDeleteBet={onDeleteBet} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
