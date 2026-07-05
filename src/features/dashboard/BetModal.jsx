import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppIcon from '../../components/ui/AppIcon'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { FormLabel } from '../../components/ui/FormLabel'
import { supabase } from '../../lib/supabase'
import { clampLines, stripEmojis, LINE_LIMIT } from '../../lib/textLimits'
import './dashboard.css'

const SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'Béisbol', 'Fútbol Americano', 'eSports', 'MMA', 'Otros']
const MARKETS = ['1X2', 'Hándicap', 'Over/Under', 'Ambos marcan', 'Otro']
const BOOKIES = ['Bet365', 'Betfair', 'Winamax', 'Bwin', 'Betway', 'Codere', 'Sportium', '888sport']

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }

function getMinDateTime() {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toLowerCase()
}

export function BetModal({ open, onClose, form, setForm, onSubmit, user, preselectedChannelId }) {
  const [mode, setMode] = useState('foto')
  const [myChannels, setMyChannels] = useState([])
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', isPrivate: false })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const [channelTab, setChannelTab] = useState('public')
  const [confirmed, setConfirmed] = useState(false)
  const fileInputRef = useRef(null)

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  useEffect(() => {
    if (!open || !user?.id || preselectedChannelId) return
    supabase.from('channels').select('id, name, is_private').eq('owner_id', user.id).is('deleted_at', null)
      .then(({ data }) => setMyChannels(data || []))
  }, [open, user?.id])

  useEffect(() => {
    if (!open) {
      setMode('foto')
      setShowCreateChannel(false)
      setCreateForm({ name: '', description: '', isPrivate: false })
      setCreateError('')
      setUploadError('')
      setChannelSearch('')
      setChannelTab('public')
      setConfirmed(false)
    }
  }, [open])

  // Suport enganxar captura de pantalla (Ctrl+V) en modo foto
  useEffect(() => {
    if (!open || mode !== 'foto') return
    const handlePaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
      if (item) {
        const file = item.getAsFile()
        if (file) handleImageFile(file)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, mode])

  // Clear photo when switching to manual
  const switchMode = (m) => {
    setMode(m)
    if (m === 'manual') set('betImageUrl', '')
  }

  const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) { setUploadError('Solo se permiten imágenes.'); return }
    setUploading(true)
    setUploadError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `bets/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('channel-files').upload(path, file, { upsert: true })
      if (error) { setUploadError(`Error al subir: ${error.message}`); return }
      const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
      set('betImageUrl', urlData.publicUrl)
    } catch {
      setUploadError('Error inesperado al subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }

  const toggleChannel = (id) => {
    const current = form.channelIds || []
    set('channelIds', current.includes(id) ? current.filter(c => c !== id) : [...current, id])
  }

  const handleCreateChannel = async () => {
    if (!createForm.name.trim()) { setCreateError('El nombre es obligatorio'); return }
    setCreating(true)
    setCreateError('')
    const { data, error } = await supabase
      .from('channels').insert({
        owner_id: user.id,
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        is_private: createForm.isPrivate,
        invite_code: generateInviteCode(),
      }).select().single()
    if (error) { setCreateError('Error al crear el canal.'); setCreating(false); return }
    setMyChannels(prev => [data, ...prev])
    set('channelIds', [...(form.channelIds || []), data.id])
    setShowCreateChannel(false)
    setCreateForm({ name: '', description: '', isPrivate: false })
    setCreating(false)
  }

  const canSubmit = confirmed && (mode === 'manual'
    ? !!(form.event && form.pick && form.odds && form.date)
    : !!(form.betImageUrl && form.odds && form.date))

  const filteredChannels = myChannels.filter(c =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase())
  )
  const publicChannels = filteredChannels.filter(c => !c.is_private)
  const privateChannels = filteredChannels.filter(c => c.is_private)

  const ChannelGroup = ({ channels }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {channels.map(c => {
        const selected = (form.channelIds || []).includes(c.id)
        return (
          <div key={c.id} onClick={() => toggleChannel(c.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selected ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.12s' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`, background: selected ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
              {selected && <AppIcon name="check" size={10} color="#010906" />}
            </div>
            <span style={{ fontSize: '13px', fontWeight: selected ? 600 : 400, color: selected ? 'var(--color-primary)' : 'var(--color-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          </div>
        )
      })}
    </div>
  )

  const ChannelSelector = (
    <div className="form-group-modal">
      <FormLabel>Publicar en canales *</FormLabel>

      {myChannels.length === 0 && !showCreateChannel ? (
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
          Necesitas al menos un canal para publicar picks.
        </div>
      ) : (
        <>
          {/* Tabs Públicos / Privados */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '3px', marginBottom: '10px' }}>
            {[
              { id: 'public',  icon: 'globe', label: 'Públicos' },
              { id: 'private', icon: 'lock',  label: 'Privados' },
            ].map(t => (
              <button key={t.id} onClick={() => { setChannelTab(t.id); setChannelSearch('') }}
                style={{ flex: 1, padding: '7px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: channelTab === t.id ? 'var(--color-primary)' : 'transparent', color: channelTab === t.id ? '#010906' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <AppIcon name={t.icon} size={12} />{t.label}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}><AppIcon name="search" size={13} /></span>
            <input
              type="text"
              placeholder="Entra el nombre del canal"
              value={channelSearch}
              onChange={e => setChannelSearch(e.target.value)}
              style={{ ...inputStyle, fontSize: '13px', padding: '8px 12px 8px 32px' }}
            />
          </div>

          {/* Llista de la pestanya activa */}
          <div style={{ marginBottom: '10px' }}>
            {(() => {
              const list = channelTab === 'public' ? publicChannels : privateChannels
              if (list.length === 0) return (
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '14px 0' }}>
                  {channelSearch
                    ? `Sin resultados para "${channelSearch}"`
                    : channelTab === 'public' ? 'No tienes canales públicos.' : 'No tienes canales privados.'}
                </div>
              )
              return <ChannelGroup channels={list} />
            })()}
          </div>
        </>
      )}

      <AnimatePresence>
        {showCreateChannel ? (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Crear canal</div>
            {createError && (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '14px' }}>{createError}</div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Nombre *</label>
              <input autoFocus type="text" placeholder="ej. MarcGol Tips" value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} maxLength={30} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Descripción (opcional)</label>
              <input type="text" placeholder="De qué va tu canal..." value={createForm.description}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} maxLength={200} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', padding: '14px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', cursor: 'pointer' }}
              onClick={() => setCreateForm(p => ({ ...p, isPrivate: !p.isPrivate }))}>
              <div style={{ width: '40px', height: '22px', borderRadius: '999px', background: createForm.isPrivate ? 'var(--color-primary)' : 'var(--color-border)', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '3px', left: createForm.isPrivate ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="lock" size={13} /> Canal privado</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Solo accesible con enlace de invitación.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={handleCreateChannel} disabled={creating || !createForm.name.trim()}>{creating ? 'Creando...' : 'Crear canal'}</Button>
              <Button variant="ghost" onClick={() => { setShowCreateChannel(false); setCreateForm({ name: '', description: '', isPrivate: false }); setCreateError('') }}>Cancelar</Button>
            </div>
          </motion.div>
        ) : (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowCreateChannel(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'transparent', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', width: '100%' }}>
            <span>+</span>{myChannels.length === 0 ? 'Crear mi primer canal' : 'Crear nuevo canal'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )

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

            {/* MODE SWITCHER */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: '20px' }}>
              {[
                { id: 'foto',   icon: 'camera',   label: 'Foto (Recomendado)' },
                { id: 'manual', icon: 'document', label: 'Manual' },
              ].map(m => (
                <button key={m.id} onClick={() => switchMode(m.id)}
                  style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', background: mode === m.id ? 'var(--color-primary)' : 'transparent', color: mode === m.id ? '#010906' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AppIcon name={m.icon} size={13} />{m.label}
                </button>
              ))}
            </div>

            {/* ── MANUAL MODE ─────────────────────────────────────── */}
            {mode === 'manual' && (
              <>
                <div className="form-group-modal">
                  <FormLabel>Evento</FormLabel>
                  <Input placeholder="ej. Real Madrid vs Barcelona"
                    value={form.event} onChange={e => set('event', stripEmojis(e.target.value))} maxLength={100} />
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
                      value={form.pick} onChange={e => set('pick', stripEmojis(e.target.value))} maxLength={100} />
                  </div>
                  <div>
                    <FormLabel>Cuota</FormLabel>
                    <Input type="number" placeholder="ej. 1.85" step="0.01" min="1.01"
                      value={form.odds} onChange={e => set('odds', e.target.value)} />
                  </div>
                </div>

                <div className="form-row-modal">
                  <div>
                    <FormLabel>Bookie</FormLabel>
                    <select className="input" value={form.bookie || ''} onChange={e => set('bookie', e.target.value)}>
                      <option value="">— Sin especificar —</option>
                      {BOOKIES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <FormLabel>Fecha y hora del evento</FormLabel>
                    <Input type="datetime-local" value={form.date}
                      min={getMinDateTime()} onChange={e => set('date', e.target.value)} />
                  </div>
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
                    value={form.analysis} onChange={e => set('analysis', clampLines(e.target.value, LINE_LIMIT.FORM))} maxLength={500} />
                </div>
              </>
            )}

            {/* ── FOTO MODE ────────────────────────────────────────── */}
            {mode === 'foto' && (
              <>
                {/* Upload zone */}
                <div className="form-group-modal">
                  <FormLabel>Foto del ticket *</FormLabel>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) handleImageFile(e.target.files[0]) }} />

                  {form.betImageUrl ? (
                    <div style={{ position: 'relative' }}>
                      <img src={form.betImageUrl} alt="ticket"
                        style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)' }} />
                      <button onClick={() => { set('betImageUrl', ''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      style={{ border: `1.5px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', transition: 'all 0.15s' }}>
                      {uploading ? (
                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="loading" size={14} /> Subiendo imagen...</div>
                      ) : (
                        <>
                          <div style={{ marginBottom: '8px', color: 'var(--color-text-muted)' }}><AppIcon name="camera" size={36} /></div>
                          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Sube la foto de tu pick</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Arrastra, toca para seleccionar o pega con Ctrl+V</div>
                        </>
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-error)' }}>{uploadError}</div>
                  )}
                </div>

                <div className="form-row-modal">
                  <div>
                    <FormLabel>Cuota *</FormLabel>
                    <Input type="number" placeholder="ej. 1.85" step="0.01" min="1.01"
                      value={form.odds} onChange={e => set('odds', e.target.value)} />
                  </div>
                  <div>
                    <FormLabel>Fecha y hora del evento *</FormLabel>
                    <Input type="datetime-local" value={form.date}
                      min={getMinDateTime()} onChange={e => set('date', e.target.value)} />
                  </div>
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
                  <FormLabel>Bookie (opcional)</FormLabel>
                  <select className="input" value={form.bookie || ''} onChange={e => set('bookie', e.target.value)}>
                    <option value="">— Sin especificar —</option>
                    {BOOKIES.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* CANAL SELECTOR */}
            {!preselectedChannelId && ChannelSelector}

            {preselectedChannelId && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '18px', padding: '10px 12px', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-primary-border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AppIcon name="canales" size={13} /> Este pick se publicará en este canal y se añadirá a tu historial.</span>
              </div>
            )}

            <label onClick={() => setConfirmed(v => !v)}
              style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', background: confirmed ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', border: `0.5px solid ${confirmed ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', marginBottom: '14px', cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${confirmed ? 'var(--color-primary)' : 'var(--color-border)'}`, background: confirmed ? 'var(--color-primary)' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {confirmed && <AppIcon name="check" size={12} color="#010906" />}
              </div>
              <span style={{ fontSize: '12px', color: confirmed ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.6 }}>
                He revisado bien el pick y entiendo que <strong>no podré editarlo ni borrarlo</strong> una vez publicado.
              </span>
            </label>

            <Button full onClick={() => onSubmit(preselectedChannelId)} disabled={!canSubmit}>
              <AppIcon name="send" size={14} style={{ marginRight: 6 }} /> Publicar Apuesta
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
