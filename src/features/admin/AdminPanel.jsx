import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

// Emails amb accés al panell d'administració.
// Afegir més si cal.
const ADMIN_EMAILS = ['fyourbet@gmail.com']

const REASON_LABELS = {
  resultado_manipulado: 'Resultado manipulado',
  cuota_editada:        'Cuota editada',
  informacion_falsa:    'Información falsa',
  pick_duplicado:       'Pick duplicado',
  otros:                'Otros',
}

function ReviewCard({ bet, reports, onClear, onInvalidate }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const act = async (fn) => {
    setLoading(true)
    await fn()
    setLoading(false)
  }

  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderLeft: '3px solid var(--color-warning)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
            {bet.event || '(pick de foto)'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>{bet.sport}</span>
            {bet.pick && bet.pick !== '-' && <span>Pick: {bet.pick}</span>}
            <span>Cuota: {parseFloat(bet.odds || 0).toFixed(2)}</span>
            <span>Stake: {bet.stake}</span>
            <span style={{ color: bet.status === 'won' ? 'var(--color-primary)' : bet.status === 'lost' ? 'var(--color-error)' : 'var(--color-text-muted)', fontWeight: 600 }}>
              {bet.status === 'won' ? '✓ Ganada' : bet.status === 'lost' ? '✗ Perdida' : '⏳ Pendiente'}
            </span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {reports.map((r, i) => (
              <span key={i} style={{ fontSize: '11px', background: 'rgba(245,158,11,0.1)', border: '0.5px solid rgba(245,158,11,0.35)', color: 'var(--color-warning)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontWeight: 600 }}>
                {REASON_LABELS[r.reason] || r.reason}
              </span>
            ))}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{reports.length} reporte{reports.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => setExpanded(v => !v)}
            style={{ padding: '6px 12px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
            {expanded ? 'Ocultar' : 'Ver detalles'}
          </button>
          <button onClick={() => act(onClear)} disabled={loading}
            style={{ padding: '6px 12px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
            ✓ Validar
          </button>
          <button onClick={() => act(onInvalidate)} disabled={loading}
            style={{ padding: '6px 12px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--color-error)', fontFamily: 'var(--font-sans)' }}>
            ✕ Invalidar
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.map((r, i) => (
            <div key={i} style={{ fontSize: '12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>{REASON_LABELS[r.reason] || r.reason}</div>
              {r.details && <div style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{r.details}</div>}
              <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
                {new Date(r.created_at).toLocaleString('es-ES')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SugerenciasTab({ adminUserId }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('suggestions')
      .select('id, message, created_at, user_id, profiles(username)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        // Les suggerències de l'admin apareixen sempre a dalt
        const sorted = [...data].sort((a, b) => {
          if (a.user_id === adminUserId) return -1
          if (b.user_id === adminUserId) return 1
          return 0
        })
        setSuggestions(sorted)
        setLoading(false)
      })
  }, [adminUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>

  if (!suggestions.length) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
      <div>Sin sugerencias aún.</div>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        {suggestions.length} sugerencia{suggestions.length !== 1 ? 's' : ''}
      </div>
      {suggestions.map(s => (
        <div key={s.id} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderLeft: '3px solid var(--color-primary)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text)', marginBottom: '8px' }}>{s.message}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', gap: '12px' }}>
            <span>{s.profiles?.username || 'Usuario desconocido'}</span>
            <span>{new Date(s.created_at).toLocaleString('es-ES')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function VerificadosTab() {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [toggling, setToggling] = useState(null)

  useEffect(() => {
    supabase.from('profiles')
      .select('id, username, avatar_url, is_verified')
      .order('username', { ascending: true })
      .then(({ data }) => { setAll(data || []); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (profile) => {
    setToggling(profile.id)
    const newVal = !profile.is_verified
    await supabase.from('profiles').update({
      is_verified: newVal,
      verified_notified: newVal ? false : false,
    }).eq('id', profile.id)
    setAll(prev => prev.map(p => p.id === profile.id ? { ...p, is_verified: newVal } : p))
    setToggling(null)
  }

  const filtered = all.filter(p =>
    !query.trim() || p.username?.toLowerCase().includes(query.trim().toLowerCase())
  )
  const verified = filtered.filter(p => p.is_verified)
  const rest = filtered.filter(p => !p.is_verified)
  const displayed = [...verified, ...rest]

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>

  return (
    <div>
      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Buscar usuario..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 14px 10px 36px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
        {verified.length} verificado{verified.length !== 1 ? 's' : ''} · {all.length} usuarios en total
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Sin resultados</div>
      )}

      {displayed.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--color-bg)', border: `0.5px solid ${p.is_verified ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderLeft: `3px solid ${p.is_verified ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', marginBottom: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
            {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.username || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>{p.username}</span>
            {p.is_verified && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px', borderRadius: '50%', background: 'var(--color-primary)', color: '#010906', fontSize: '9px', fontWeight: 900 }}>✓</span>
            )}
          </div>
          <button onClick={() => handleToggle(p)} disabled={toggling === p.id}
            style={{ padding: '5px 12px', border: `0.5px solid ${p.is_verified ? 'var(--color-error-border)' : 'var(--color-primary-border)'}`, borderRadius: 'var(--radius-md)', background: p.is_verified ? 'var(--color-error-light)' : 'var(--color-primary-light)', color: p.is_verified ? 'var(--color-error)' : 'var(--color-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: toggling === p.id ? 0.5 : 1 }}>
            {p.is_verified ? '✕ Desverificar' : '✓ Verificar'}
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AdminPanel({ user }) {
  const [reviewBets, setReviewBets] = useState([])
  const [reportsByBet, setReportsByBet] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('review')

  // Comprova accés admin per email
  const isAdmin = ADMIN_EMAILS.includes(user?.email)

  const fetchReviewBets = async () => {
    setLoading(true)
    // Picks en revisió pendent
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('review_status', 'review')
      .order('created_at', { ascending: false })

    if (!bets?.length) { setReviewBets([]); setReportsByBet({}); setLoading(false); return }

    const betIds = bets.map(b => b.id)
    const { data: reports } = await supabase
      .from('bet_reports')
      .select('bet_id, reason, details, created_at')
      .in('bet_id', betIds)
      .order('created_at', { ascending: false })

    const rMap = {}
    for (const r of reports || []) {
      if (!rMap[r.bet_id]) rMap[r.bet_id] = []
      rMap[r.bet_id].push(r)
    }

    setReviewBets(bets)
    setReportsByBet(rMap)
    setLoading(false)
  }

  const handleClear = async (betId) => {
    // Validat → review_status = 'cleared', torna a comptar a les estadístiques
    await supabase.from('bets').update({ review_status: 'cleared' }).eq('id', betId)
    setReviewBets(prev => prev.filter(b => b.id !== betId))
  }

  const handleInvalidate = async (betId) => {
    // Invalidat → review_status = 'invalid', exclòs permanentment de les estadístiques
    await supabase.from('bets').update({ review_status: 'invalid' }).eq('id', betId)
    setReviewBets(prev => prev.filter(b => b.id !== betId))
  }

  // useEffect després de totes les funcions per evitar "accessed before declared"
  useEffect(() => {
    if (!isAdmin) return
    fetchReviewBets()
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/rules-of-hooks

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
        <div>Acceso restringido.</div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontWeight: 700, fontSize: '22px', marginBottom: '4px' }}>⚙️ Centro de control</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Gestión interna de FYB.</p>
      </div>

      {/* Pestanyes del panell */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '0.5px solid var(--color-border)', marginBottom: '20px' }}>
        {[
          { id: 'review',       label: `🚩 Picks en revisión${reviewBets.length > 0 ? ` (${reviewBets.length})` : ''}` },
          { id: 'sugerencias',  label: '💬 Sugerencias' },
          { id: 'verificados',  label: '✓ Verificados' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 16px', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'sugerencias' && <SugerenciasTab adminUserId={user?.id} />}
      {activeTab === 'verificados' && <VerificadosTab />}

      {activeTab === 'review' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando...</div>
          ) : reviewBets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div>Sin picks pendientes de revisión.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                {reviewBets.length} pick{reviewBets.length !== 1 ? 's' : ''} pendiente{reviewBets.length !== 1 ? 's' : ''} de revisión · <button onClick={fetchReviewBets} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', padding: 0 }}>Actualizar</button>
              </div>
              {reviewBets.map(bet => (
                <ReviewCard
                  key={bet.id}
                  bet={bet}
                  reports={reportsByBet[bet.id] || []}
                  onClear={() => handleClear(bet.id)}
                  onInvalidate={() => handleInvalidate(bet.id)}
                />
              ))}
            </>
          )}
        </>
      )}
    </motion.div>
  )
}
