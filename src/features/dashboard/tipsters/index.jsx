import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useFollow } from '../social/hooks/useFollow'
import ProfileView from '../social/ProfileView'
import Username from '../../../components/ui/Username'
import SharedAvatar from '../../../components/ui/Avatar'

const SORT_OPTIONS = [
  { id: 'yield',   label: 'Yield' },
  { id: 'bets',    label: 'Apuestas' },
  { id: 'oldest',  label: 'Más antiguo' },
  { id: 'avgOdds', label: 'Promedio' },
]

function Avatar({ url, name, size = 48, fontSize = 18 }) {
  return (
    <SharedAvatar url={url} name={name} size={size} fontSize={fontSize}
      borderWidth={2} bg="var(--color-primary-light)" fg="var(--color-primary)" />
  )
}

function TipsterCard({ tipster, isFollowing, isMutual, onClick }) {
  const { stats } = tipster

  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(15,110,86,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' }}>

      <Avatar url={tipster.avatar_url} name={tipster.username} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>
            <Username username={tipster.username} isVerified={tipster.is_verified} size="md" />
          </span>
          {isMutual ? (
            <span style={{ fontSize: '10px', color: 'var(--color-primary)', padding: '2px 8px', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>👥 Amigos</span>
          ) : isFollowing && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '2px 8px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)' }}>Siguiendo</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        {stats.total > 0 ? (
          <>
            <span style={{ fontSize: '13px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
              {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}% yield
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {Math.round(stats.winRate)}% · {stats.total} picks
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
    // Només won/lost compten. 'void' (nul) i 'pending' ignorats per stats.
    if (b.status !== 'won' && b.status !== 'lost') continue
    if (!statsMap[b.user_id]) statsMap[b.user_id] = { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0, oddsSum: 0 }
    const s = statsMap[b.user_id]
    s.total++
    s.stakeSum += b.stake
    s.oddsSum += b.odds || 0
    if (b.status === 'won') { s.won++; s.profit += b.stake * (b.odds - 1) }
    else { s.lost++; s.profit -= b.stake }
  }
  return profiles.map(p => {
    const s = statsMap[p.id] || { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0, oddsSum: 0 }
    const yieldVal = s.stakeSum > 0 ? (s.profit / s.stakeSum) * 100 : 0
    const winRate  = s.total > 0 ? (s.won / s.total) * 100 : 0
    const avgOdds  = s.total > 0 ? s.oddsSum / s.total : 0
    return { ...p, stats: { ...s, yieldVal, winRate, avgOdds } }
  })
}

function pickRandom20(pool) {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 20)
}

function sortFollowing(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'yield')   return b.stats.yieldVal - a.stats.yieldVal
    if (sort === 'bets')    return b.stats.total - a.stats.total
    if (sort === 'oldest')  return new Date(a._followedAt) - new Date(b._followedAt)
    if (sort === 'avgOdds') return b.stats.avgOdds - a.stats.avgOdds
    return 0
  })
}

export default function Tipsters({ user, onNavigateToChannel, onStartDM }) {
  // Siguiendo és el tab predeterminat
  const [activeTab, setActiveTab] = useState('siguiendo')
  const [query, setQuery] = useState('')

  // Sugeridos
  const [pool, setPool] = useState([])
  const [displayed, setDisplayed] = useState([])
  const [loading, setLoading] = useState(false)

  // Siguiendo
  const [following, setFollowing] = useState(null)   // null = not loaded yet
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingSort, setFollowingSort] = useState('yield')

  // Verificados
  const [verificados, setVerificados] = useState(null)
  const [verificadosLoading, setVerificadosLoading] = useState(false)

  // Search
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)

  const [selectedUserId, setSelectedUserId] = useState(null)
  const { follow, unfollow, isFollowing, isFollower, isMutual } = useFollow(user?.id)

  // Carregar siguiendo per defecte. Depenem de user?.id (no de l'objecte user)
  // perquè si user prop és null al muntar, el fetch retorna i sense aquesta dep
  // mai més es disparava. Ara es dispara tan aviat com user.id estigui disponible.
  useEffect(() => { if (user?.id) loadSiguiendo() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSugeridos = async (attempt = 0) => {
    if (attempt === 0) setLoading(true)
    const safetyTimer = setTimeout(() => {
      setLoading(false)
      if (attempt === 0) loadSugeridos(1)
    }, 5000)
    try {
      const uid = user?.id || ''

      const [
        { data: profiles },
        { data: bets },
        { data: myFollowing },
        { data: myFollowers },
      ] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, bio, is_verified').neq('id', uid).limit(200),
        supabase.from('bets').select('user_id, stake, status, odds').in('status', ['won', 'lost']).limit(3000),
        supabase.from('follows').select('following_id').eq('follower_id', uid),
        supabase.from('follows').select('follower_id').eq('following_id', uid),
      ])

      if (!profiles?.length) return

      const followingSet = new Set((myFollowing || []).map(f => f.following_id))
      const followerSet  = new Set((myFollowers || []).map(f => f.follower_id))

      const secondDegreeMap = {}
      if (followingSet.size > 0) {
        const { data: fof } = await supabase
          .from('follows').select('following_id')
          .in('follower_id', [...followingSet])
          .neq('following_id', uid).limit(2000)
        for (const f of (fof || [])) {
          if (!followingSet.has(f.following_id))
            secondDegreeMap[f.following_id] = (secondDegreeMap[f.following_id] || 0) + 1
        }
      }

      const statsMap = {}
      for (const b of (bets || [])) {
        if (!statsMap[b.user_id]) statsMap[b.user_id] = { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
        const s = statsMap[b.user_id]
        s.total++; s.stakeSum += b.stake
        if (b.status === 'won') { s.won++; s.profit += b.stake * (b.odds - 1) }
        else { s.lost++; s.profit -= b.stake }
      }

      const scored = profiles
        .map(p => {
          // Exclou els que ja segueixes — apareixeran a Siguiendo
          if (followingSet.has(p.id)) return null

          const s = statsMap[p.id] || { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
          const yieldVal  = s.stakeSum > 0 ? (s.profit / s.stakeSum) * 100 : 0
          const winRate   = s.total > 0 ? (s.won / s.total) * 100 : 0
          const isFlwr    = followerSet.has(p.id)
          const secondDeg = secondDegreeMap[p.id] || 0
          const socialScore = Math.min(100, (isFlwr ? 35 : 0) + Math.min(40, secondDeg * 8))
          const perfScore   = s.total >= 5 ? Math.min(100, Math.max(0, 50 + yieldVal * 2) * 0.55 + winRate * 0.45) : s.total > 0 ? 15 : 5
          const credScore   = Math.min(100, (s.total / 30) * 100)
          const profileScore = (p.bio ? 50 : 0) + (p.avatar_url ? 50 : 0)
          const finalScore  = socialScore * 0.40 + perfScore * 0.35 + credScore * 0.15 + profileScore * 0.10

          return { ...p, stats: { ...s, yieldVal, winRate }, _score: finalScore }
        })
        .filter(Boolean)
        .sort((a, b) => b._score - a._score)
        .slice(0, 60)

      setPool(scored)
      setDisplayed(pickRandom20(scored))
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  // attempt: si és un retry no mostrem "Cargando" — l'usuari ja ho ha demanat
  const loadSiguiendo = async (attempt = 0) => {
    if (!user?.id) return
    if (attempt === 0) setFollowingLoading(true)
    // Safety: si una query es penja >5s, sortim del loading. Si era el primer intent
    // i no hem aconseguit dades, retry automàtic (sovint el JWT s'ha refrescat entretant).
    const safetyTimer = setTimeout(() => {
      setFollowingLoading(false)
      if (attempt === 0) loadSiguiendo(1)
    }, 5000)
    try {
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id, created_at')
        .eq('follower_id', user.id)

      if (!followRows?.length) { setFollowing([]); return }

      const ids = followRows.map(f => f.following_id)
      const followDateMap = {}
      followRows.forEach(f => { followDateMap[f.following_id] = f.created_at })

      const [{ data: profiles }, { data: bets }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, bio, is_verified').in('id', ids),
        supabase.from('bets').select('user_id, stake, status, odds').in('user_id', ids).in('status', ['won', 'lost']).limit(2000),
      ])

      const enriched = enrichWithStats(profiles || [], bets || [])
        .map(p => ({ ...p, _followedAt: followDateMap[p.id] }))

      setFollowing(enriched)
    } catch (e) {
      // Si era el primer intent, dispara retry. Sinó deixem llista buida.
      if (attempt === 0) {
        clearTimeout(safetyTimer)
        return loadSiguiendo(1)
      }
      setFollowing([])
    } finally {
      clearTimeout(safetyTimer)
      setFollowingLoading(false)
    }
  }

  const loadVerificados = async (attempt = 0) => {
    if (!user?.id) return
    if (attempt === 0) setVerificadosLoading(true)
    const safetyTimer = setTimeout(() => {
      setVerificadosLoading(false)
      if (attempt === 0) loadVerificados(1)
    }, 5000)
    try {
      const { data: followRows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      const followingSet = new Set((followRows || []).map(f => f.following_id))

      // Tots els perfils verificats que l'usuari no segueix
      const { data: profiles } = await supabase.from('profiles')
        .select('id, username, avatar_url, bio, is_verified')
        .eq('is_verified', true)
        .neq('id', user.id)

      const unfolloedVerified = (profiles || []).filter(p => !followingSet.has(p.id))
      if (!unfolloedVerified.length) { setVerificados([]); return }

      const ids = unfolloedVerified.map(p => p.id)
      const { data: bets } = await supabase.from('bets').select('user_id, stake, status, odds')
        .in('user_id', ids).in('status', ['won', 'lost']).limit(2000)

      setVerificados(enrichWithStats(unfolloedVerified, bets || []))
    } catch (e) {
      if (attempt === 0) { clearTimeout(safetyTimer); return loadVerificados(1) }
      setVerificados([])
    } finally {
      clearTimeout(safetyTimer)
      setVerificadosLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setQuery('')
    setSearchResults([])
    if (tab === 'siguiendo' && following === null) loadSiguiendo()
    if (tab === 'sugeridos' && pool.length === 0) loadSugeridos()
    if (tab === 'verificados' && verificados === null) loadVerificados()
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
      .from('profiles').select('id, username, name, avatar_url, bio, is_verified')
      .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
      .neq('id', user?.id || '').limit(20)

    const visibleProfiles = profiles || []
    if (!visibleProfiles.length) { setSearchResults([]); setSearching(false); return }

    const ids = visibleProfiles.map(p => p.id)
    const { data: bets } = await supabase
      .from('bets').select('user_id, odds, stake, status')
      .in('user_id', ids).in('status', ['won', 'lost']).limit(500)

    setSearchResults(enrichWithStats(visibleProfiles, bets || []))
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
  const sortedFollowing = following ? sortFollowing(following, followingSort) : []

  return (
    <motion.div key="tipsters" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700, marginBottom: '4px' }}>Tipsters</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Descubre los mejores pronosticadores</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
        {[
          { id: 'siguiendo',   label: '👤 Siguiendo' },
          { id: 'sugeridos',   label: '✨ Sugeridos' },
          { id: 'verificados', label: '✓ Verificados' },
        ].map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', background: activeTab === t.id ? 'var(--color-primary)' : 'transparent', color: activeTab === t.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
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

      {/* Search results */}
      {showSearch && (
        <>
          {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px' }}>Buscando tipsters...</div>}
          {!searching && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px 20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔎</div>
              No se encontraron tipsters con ese nombre
            </div>
          )}
          {!searching && (
            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <TipsterCard tipster={t} isFollowing={isFollowing(t.id)} isMutual={isMutual(t.id)} onClick={() => setSelectedUserId(t.id)} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Tab content */}
      {!showSearch && (
        <>
          {/* ── SUGERIDOS ── */}
          {activeTab === 'sugeridos' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Tipsters sugeridos
                </div>
                {pool.length > 0 && (
                  <button onClick={() => setDisplayed(pickRandom20(pool))}
                    style={{ background: 'none', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔄 Otros
                  </button>
                )}
              </div>

              {loading && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px' }}>⏳ Cargando tipsters...</div>}

              {!loading && displayed.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
                  <div style={{ fontWeight: 600 }}>Aún no hay tipsters registrados</div>
                </div>
              )}

              <AnimatePresence>
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {displayed.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <TipsterCard tipster={t} isFollowing={isFollowing(t.id)} isMutual={isMutual(t.id)} onClick={() => setSelectedUserId(t.id)} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {/* ── VERIFICADOS ── */}
          {activeTab === 'verificados' && (
            <>
              {verificadosLoading && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px' }}>⏳ Cargando...</div>}
              {!verificadosLoading && verificados !== null && verificados.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
                  <div style={{ fontWeight: 600 }}>Sin tipsters verificados aún</div>
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>O ya sigues a todos los verificados</div>
                </div>
              )}
              <AnimatePresence>
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(verificados || []).map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <TipsterCard tipster={t} isFollowing={isFollowing(t.id)} isMutual={isMutual(t.id)} onClick={() => setSelectedUserId(t.id)} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </>
          )}

          {/* ── SIGUIENDO ── */}
          {activeTab === 'siguiendo' && (
            <>
              {/* Sort pills */}
              {!followingLoading && following !== null && following.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setFollowingSort(opt.id)}
                      style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `0.5px solid ${followingSort === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: followingSort === opt.id ? 'var(--color-primary-light)' : 'var(--color-bg)', color: followingSort === opt.id ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '12px', fontWeight: followingSort === opt.id ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {followingLoading && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px' }}>⏳ Cargando...</div>}

              {/* Fallback: si despres del retry automatic seguim sense dades, oferim retry manual */}
              {!followingLoading && following === null && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                  <div style={{ fontWeight: 600, marginBottom: '12px' }}>No se han podido cargar los tipsters</div>
                  <button onClick={() => loadSiguiendo()}
                    style={{ background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '10px 22px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    Reintentar
                  </button>
                </div>
              )}

              {!followingLoading && following !== null && following.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>👤</div>
                  <div style={{ fontWeight: 600 }}>Aún no sigues a nadie</div>
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>Descubre tipsters en la pestaña Sugeridos</div>
                </div>
              )}

              <AnimatePresence>
                <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sortedFollowing.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <TipsterCard tipster={t} isFollowing={true} isMutual={isMutual(t.id)} onClick={() => setSelectedUserId(t.id)} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </>
      )}
    </motion.div>
  )
}
