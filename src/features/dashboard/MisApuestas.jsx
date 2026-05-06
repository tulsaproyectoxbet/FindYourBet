import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'
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

export default function MisApuestas({ bets, loadingBets, won, lost, yieldVal, avgOdds, onNewBet, onResolveBet, onDeleteBet, period, onPeriodChange }) {
  const KPIs = [
    { label: 'Yield', value: `${yieldVal.toFixed(2)}%`, colorClass: yieldVal >= 0 ? 'green' : 'red', sub: 'Beneficio sobre lo apostado' },
    { label: 'W / L', value: `${won.length} / ${lost.length}`, colorClass: '', sub: 'Ganadas / Perdidas' },
    { label: 'Total Apuestas', value: bets.length, colorClass: '', sub: 'Historial completo' },
    { label: 'Cuota Media', value: avgOdds, colorClass: 'yellow', sub: 'Promedio de cuotas' },
  ]

  return (
    <motion.div key="apuestas"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Historial de Apuestas</h2>
        <p>Tus apuestas registradas. Una vez empieza el partido, no se pueden modificar.</p>
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

      <div className="section-head">
        <div className="section-title">Apuestas</div>
        <Button size="sm" onClick={onNewBet}>+ Nueva Apuesta</Button>
      </div>

      <div className="bets-table">
        {loadingBets ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div>Cargando apuestas...</div>
          </div>
        ) : bets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Sin apuestas en este período</div>
            <div className="empty-sub">No hay apuestas registradas para el período seleccionado.</div>
          </div>
        ) : (
          <>
            <div className="table-header">
              <span>Evento</span><span>Cuota</span><span>Stake</span><span>Estado</span><span>Acción</span>
            </div>
            <AnimatePresence>
              {bets.map(b => {
                const started = hasMatchStarted(b)
                return (
                  <motion.div key={b.id} className="table-row"
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                    <div>
                      <div className="event-name">{b.event}</div>
                      <div className="event-meta">
                        {b.sport} · {b.market} · <strong>{b.pick}</strong> · {new Date(b.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {!started && b.status === 'pending' && (
                          <span style={{ marginLeft: '6px', color: 'var(--color-primary)', fontWeight: 600 }}>· ⏳ No iniciado</span>
                        )}
                        {started && b.status === 'pending' && (
                          <span style={{ marginLeft: '6px', color: 'var(--color-warning)', fontWeight: 600 }}>· 🔴 En curso</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontWeight: 600 }}>{parseFloat(b.odds).toFixed(2)}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>S{b.stake}</span>
                    <span>
                      {b.status === 'won' && <span className="badge badge-green">Ganada ✓</span>}
                      {b.status === 'lost' && <span className="badge badge-red">Perdida ✗</span>}
                      {b.status === 'pending' && <span className="badge badge-gray">Pendiente</span>}
                    </span>
                    <div className="resolve-btns">
                      {b.status === 'pending' && !started && (
                        // Abans del partit: només esborrar
                        <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => onDeleteBet(b.id)}
                          style={{ background: 'var(--color-error-light)', color: 'var(--color-error)', border: '0.5px solid var(--color-error-border)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                          🗑️ Borrar
                        </motion.button>
                      )}
                      {b.status === 'pending' && started && (
                        // Quan el partit ha començat: Win/Loss
                        <>
                          <motion.button className="btn-win"
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => onResolveBet(b.id, 'won')}>✓ Win</motion.button>
                          <motion.button className="btn-loss"
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => onResolveBet(b.id, 'lost')}>✗ Loss</motion.button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  )
}