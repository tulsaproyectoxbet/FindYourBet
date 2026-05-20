import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useFollow } from '../social/hooks/useFollow'
import ProfileView from '../social/ProfileView'

const TIER_LABEL = (total, yieldVal) =>
  total >= 150 && yieldVal >= 15 ? '💎 Elite'
  : total >= 80 && yieldVal >= 10 ? '🥇 Gold'
  : total >= 30 && yieldVal >= 5 ? '🥈 Silver'
  : total >= 10 ? '🥉 Bronze'
  : null

function Avatar({ url, name, size = 48, fontSize = 18 }) {
  if (url) return (
    <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-bg)', flexShrink: 0 }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 700, color: 'var(--color-primary)', border: '2px solid var(--color-bg)', flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function TipsterCard({ tipster, isFollowing, isMutual, onClick }) {
  const { stats } = tipster
  const tier = TIER_LABEL(stats.total, stats.yieldVal)
  const displayName = tipster.username

  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(15,110,86,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}>

      <Avatar url={tipster.avatar_url} name={displayName} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{displayName}</span>
          {tier && (
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '0.5px solid var(--color-primary-border)', fontWeight: 700 }}>{tier}</span>
          )}
          {isMutual ? (
            <span style={{ fontSize: '10px', color: 'var(--color-primary)', padding: '2px 8px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>👥 Amigos</span>
          ) : isFollowing && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '2px 8px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)' }}>Siguiendo</span>
          )}
        </div>
        {tipster.username && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>@{tipster.username}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        {stats.total > 0 ? (
          <>
            <span style={{ fontSize: '13px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
              {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}% yield
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {stats.won}W / {stats.lost}L · {stats.total} picks
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sin picks</span>
        )}
      </div>
    </div>
  )
}

function enrichWithStats(profiles, bets) {
  const statsMap = {}
  for (const b of (bets || [])) {
    if (!statsMap[b.user_id]) statsMap[b.user_id] = { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
    const s = statsMap[b.user_id]
    s.total++
    s.stakeSum += b.stake
    if (b.status === 'won') { s.won++; s.profit += b.stake * (b.odds - 1) }
    else { s.lost++; s.profit -= b.stake }
  }
  return profiles.map(p => {
    const s = statsMap[p.id] || { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
    const yieldVal = s.stakeSum > 0 ? (s.profit / s.stakeSum) * 100 : 0
    return { ...p, stats: { ...s, yieldVal, winRate: s.total > 0 ? (s.won / s.total) * 100 : 0 } }
  })
}

export default function Tipsters({ user, onNavigateToChannel, onStartDM }) {
  const [query, setQuery] = useState('')
  const [popular, setPopular] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const { follow, unfollow, isFollowing, isFollower, isMutual } = useFollow(user?.id)
  const searchTimeout = useRef(null)

  useEffect(() => { loadPopular() }, [])

  const loadPopular = async () => {
    setLoading(true)
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      const [{ data: bets }, { data: profiles }] = await Promise.all([
        supabase.from('bets').select('user_id, stake, status, odds')
          .in('status', ['won', 'lost']).limit(2000),
        supabase.from('profiles').select('id, username, name, avatar_url, bio')
          .neq('id', user?.id || '').limit(100),
      ])

      if (!profiles?.length) return

      const enriched = enrichWithStats(profiles, bets || [])
        .sort((a, b) => {
          const aScore = a.stats.total >= 5 ? a.stats.yieldVal : -999
          const bScore = b.stats.total >= 5 ? b.stats.yieldVal : -999
          return bScore - aScore
        })
        .slice(0, 30)

      setPopular(enriched)
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const handleSearch = (q) => {
    setQuery(q)
    clearTimeout(searchTimeout.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(() => runSearch(q), 300)
  }

  const runSearch = async (q) => {
    setSearching(true)
    const { data: profiles } = await supabase
      .from('profiles').select('id, username, name, avatar_url, bio')
      .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
      .neq('id', user?.id || '')
      .limit(20)

    if (!profiles?.length) { setSearchResults([]); setSearching(false); return }

    const ids = profiles.map(p => p.id)
    const { data: bets } = await supabase
      .from('bets').select('user_id, odds, stake, status')
      .in('user_id', ids).in('status', ['won', 'lost']).limit(500)

    setSearchResults(enrichWithStats(profiles, bets || []))
    setSearching(false)
  }

  if (selectedUserId) {
    return (
      <ProfileView
        userId={selectedUserId}
        currentUser={user}
        onBack={() => setSelectedUserId(null)}
        onStartDM={onStartDM || (() => {})}
        isFollowing={isFollowing(selectedUserId)}
        isFollower={isFollower(selectedUserId)}
        onFollow={follow}
        onUnfollow={unfollow}
        onNavigateToChannel={onNavigateToChannel}
        onBlock={() => alert('Usuario bloqueado.')}
        onReport={() => {}}
      />
    )
  }

  const showSearch = query.trim().length > 0
  const list = showSearch ? searchResults : popular

  return (
    <motion.div key="tipsters" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700, marginBottom: '4px' }}>Tipsters</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Descubre los mejores pronosticadores</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Busca tipsters por nombre o usuario..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 16px 12px 40px', borderRadius: 'var(--radius-lg)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none', opacity: 0.5 }}>🔍</span>
      </div>

      {searching && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px' }}>Buscando tipsters...</div>
      )}

      {!searching && (
        <>
          {!showSearch && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              🏆 Mejores tipsters
            </div>
          )}

          {showSearch && searchResults.length === 0 && !searching && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px 20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔎</div>
              No se encontraron tipsters con ese nombre
            </div>
          )}

          {loading && !showSearch && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px' }}>⏳ Cargando tipsters...</div>
          )}

          {!loading && !showSearch && popular.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontWeight: 600 }}>Aún no hay tipsters registrados</div>
            </div>
          )}

          <AnimatePresence>
            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {list.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <TipsterCard
                    tipster={t}
                    isFollowing={isFollowing(t.id)}
                    isMutual={isMutual(t.id)}
                    onClick={() => setSelectedUserId(t.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}
