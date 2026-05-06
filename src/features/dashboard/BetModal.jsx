import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import { supabase } from '../../lib/supabase'
import './dashboard.css'

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Fútbol Americano', 'eSports', 'MMA', 'Otros']
const MARKETS = ['1X2', 'Hándicap', 'Over/Under', 'Ambos marcan', 'Otro']

function getMinDateTime() {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function BetModal({ open, onClose, form, setForm, onSubmit, user, preselectedChannelId }) {
  const [myChannels, setMyChannels] = useState([])
  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  useEffect(() => {
    if (!open || !user?.id || preselectedChannelId) return
    supabase.from('channels').select('id, name').eq('owner_id', user.id)
      .then(({ data }) => setMyChannels(data || []))
  }, [open, user])

  const toggleChannel = (id) => {
    const current = form.channelIds || []
    set('channelIds', current.includes(id)
      ? current.filter(c => c !== id)
      : [...current, id]
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className="modal"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <div className="modal-title">Nueva Apuesta</div>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>

            <div className="form-group-modal">
              <FormLabel>Evento</FormLabel>
              <Input placeholder="ej. Real Madrid vs Barcelona"
                value={form.event} onChange={e => set('event', e.target.value)} />
            </div>

            <div className="form-row-modal">
              <div>
                <FormLabel>Deporte</FormLabel>
                <select className="input" value={form.sport} onChange={e => set('sport', e.target.value)}>
                  {SPORTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <FormLabel>Mercado</FormLabel>
                <select className="input" value={form.market} onChange={e => set('market', e.target.value)}>
                  {MARKETS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row-modal">
              <div>
                <FormLabel>Selección</FormLabel>
                <Input placeholder="ej. Real Madrid"
                  value={form.pick} onChange={e => set('pick', e.target.value)} />
              </div>
              <div>
                <FormLabel>Cuota</FormLabel>
                <Input type="number" placeholder="ej. 1.85" step="0.01" min="1.01"
                  value={form.odds} onChange={e => set('odds', e.target.value)} />
              </div>
            </div>

            <div className="form-group-modal">
              <FormLabel>Fecha y hora del evento</FormLabel>
              <Input type="datetime-local" value={form.date}
                min={getMinDateTime()} onChange={e => set('date', e.target.value)} />
            </div>

            <div className="form-group-modal">
              <FormLabel>Stake (1–10)</FormLabel>
              <div className="stake-display">{form.stake}</div>
              <div className="stake-sub">% del bankroll recomendado</div>
              <input type="range" min="1" max="10" value={form.stake}
                onChange={e => set('stake', parseInt(e.target.value))}
                className="stake-slider" />
            </div>

            <div className="form-group-modal">
              <FormLabel>Análisis (opcional)</FormLabel>
              <textarea className="input" rows="3" style={{ resize: 'vertical' }}
                placeholder="Explica brevemente tu razonamiento..."
                value={form.analysis} onChange={e => set('analysis', e.target.value)} />
            </div>

            {/* SELECTOR CANALS — només si no ve preseleccionat */}
            {!preselectedChannelId && (
              <div className="form-group-modal">
                <FormLabel>Publicar en canales *</FormLabel>
                {myChannels.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '10px 0' }}>
                    No tienes canales propios. Crea uno primero.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {myChannels.map(c => {
                      const selected = (form.channelIds || []).includes(c.id)
                      return (
                        <div key={c.id} onClick={() => toggleChannel(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selected ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selected ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selected && <span style={{ color: '#010906', fontSize: '10px', fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: selected ? 600 : 400, color: selected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                            #{c.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {preselectedChannelId && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '18px', padding: '10px 12px', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-primary-border)' }}>
                📡 Esta apuesta se publicará en este canal y se añadirá a tu historial.
              </div>
            )}

            <Button full onClick={() => onSubmit(preselectedChannelId)}>📤 Publicar Apuesta</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}