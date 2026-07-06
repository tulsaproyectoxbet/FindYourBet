import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'
import { supabase } from '../../lib/supabase'
import { useProfileNav } from '../../contexts/ProfileNavContext'
import Username from '../../components/ui/Username'
import AppIcon from '../../components/ui/AppIcon'
import './dashboard.css'

// ── Exports mantinguts per RankingAmigos i altres consumidors ──────────────
export const MIN_BETS = 10
export const MAIN_SPORTS = ['Fútbol', 'Baloncesto', 'Tenis', 'eSports']
export const SPORTS_LIST = [...MAIN_SPORTS, 'Otros']
export const SPORT_ICONS = { 'Fútbol': '⚽', 'Baloncesto': '🏀', 'Tenis': '🎾', 'eSports': '🎮', 'Otros': '🏅' }
export const PERIODS = [
  { id: 'trimestral', label: 'Global' },
  { id: 'setmanal',   label: 'Semanal' },
  { id: 'mensual',    label: 'Mensual' },
  { id: 'anual',      label: 'Anual' },
  { id: 'total',      label: 'Total' },
]

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
  const resolved = bets.filter(b => b.status === 'won' || b.status === 'lost')
  if (resolved.length < MIN_BETS) return null
  const { profit, stakeSum } = resolved.reduce(
    (acc, b) => ({
      stakeSum: acc.stakeSum + b.stake,
      profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake),
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

function matchesSport(bet, sport) {
  if (sport === 'Otros') return !MAIN_SPORTS.includes(bet.sport)
  return bet.sport === sport
}

function getBestCombination(userBets, selectedSports) {
  const validSports = selectedSports.filter(sport => {
    const sportBets = userBets.filter(b => matchesSport(b, sport) && (b.status === 'won' || b.status === 'lost'))
    return sportBets.length >= MIN_BETS
  })
  if (validSports.length === 0) return null
  const combos = getCombinations(validSports)
  let best = null
  for (const combo of combos) {
    const comboBets = userBets.filter(b => combo.some(s => matchesSport(b, s)))
    const y = calcYieldFromBets(comboBets)
    if (y !== null && (best === null || y > best.yieldVal)) {
      best = { yieldVal: y, bets: comboBets, sports: combo }
    }
  }
  return best
}

export function useRanking(period, selectedSports, scope = 'public', filterUserIds = null) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRanking = async () => {
    if (filterUserIds !== null && filterUserIds.length === 0) {
      setRanking([]); setLoading(false); return
    }
    setLoading(true)
    const safetyTimer = setTimeout(() => setLoading(false), 10000)
    try {
      const range = getPeriodRange(period)
      let query = supabase
        .from('bets')
        .select('user_id, odds, stake, status, date, sport, was_private, channel_id')
        .neq('status', 'pending')
        .eq('was_private', scope === 'private')
        .not('review_status', 'in', '("review","invalid")')
        .limit(2000)
      if (range) {
        query = query.gte('date', range.start.toISOString()).lte('date', range.end.toISOString())
      }
      if (filterUserIds !== null) {
        query = query.in('user_id', filterUserIds)
      }
      const { data: bets, error } = await query
      if (error || !bets) { setLoading(false); return }

      let filteredBets = bets
      if (scope === 'private') {
        const { data: activeOffers } = await supabase
          .from('offers').select('channel_id').eq('active', true)
        const premiumIds = new Set((activeOffers || []).map(o => o.channel_id))
        filteredBets = bets.filter(b => premiumIds.has(b.channel_id))
      }

      const byUser = {}
      filteredBets.forEach(b => {
        if (!byUser[b.user_id]) byUser[b.user_id] = []
        byUser[b.user_id].push(b)
      })

      const isTodos = selectedSports.length === 0

      const entries = Object.entries(byUser)
        .map(([userId, userBets]) => {
          let finalBets, usedSports
          if (isTodos) {
            const resolved = userBets.filter(b => b.status === 'won' || b.status === 'lost')
            if (resolved.length < MIN_BETS) return null
            finalBets = userBets
            usedSports = null
          } else {
            const best = getBestCombination(userBets, selectedSports)
            if (!best) return null
            finalBets = best.bets
            usedSports = best.sports
          }

          const resolved = finalBets.filter(b => b.status === 'won' || b.status === 'lost')
          const won = finalBets.filter(b => b.status === 'won').length
          const lost = finalBets.filter(b => b.status === 'lost').length
          const yieldVal = calcYieldFromBets(finalBets)
          if (yieldVal === null) return null

          const avgOdds = finalBets.length > 0
            ? (finalBets.reduce((s, b) => s + b.odds, 0) / finalBets.length).toFixed(2)
            : '—'

          const stakeFreq = {}
          finalBets.forEach(b => { stakeFreq[b.stake] = (stakeFreq[b.stake] || 0) + 1 })
          const habitualStake = finalBets.length > 0
            ? Object.entries(stakeFreq).sort((a, b) => b[1] - a[1])[0][0]
            : '—'

          return { userId, bets: resolved.length, won, lost, yieldVal, avgOdds, habitualStake, usedSports }
        })
        .filter(Boolean)
        .sort((a, b) => b.yieldVal - a.yieldVal)

      if (entries.length === 0) { setRanking([]); setLoading(false); return }

      const userIds = entries.map(e => e.userId)
      const { data: profiles } = await supabase
        .from('profiles').select('id, username, hide_from_ranking, is_verified').in('id', userIds)

      const profileMap = {}
      const verifiedSet = new Set()
      const hiddenSet = new Set()
      profiles?.forEach(p => {
        if (p.hide_from_ranking) hiddenSet.add(p.id)
        else profileMap[p.id] = p.username
        if (p.is_verified) verifiedSet.add(p.id)
      })

      setRanking(
        entries
          .filter(e => !hiddenSet.has(e.userId))
          .map(e => ({ ...e, username: profileMap[e.userId] ?? e.userId.slice(0, 6), isVerified: verifiedSet.has(e.userId) }))
          .slice(0, 50)
      )
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRanking()
    const interval = setInterval(fetchRanking, 60000)
    return () => clearInterval(interval)
  }, [period, JSON.stringify(selectedSports), scope, JSON.stringify(filterUserIds)])

  return { ranking, loading }
}

export function PeriodDropdown({ period, setPeriod }) {
  const [open, setOpen] = useState(false)
  const selected = PERIODS.find(p => p.id === period)
  const isGlobal = period === 'trimestral'

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          background: isGlobal ? 'var(--color-primary-light)' : 'var(--color-bg-soft)',
          border: isGlobal ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-border)',
          color: isGlobal ? 'var(--color-primary)' : 'var(--color-text)',
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700,
          padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px', justifyContent: 'space-between',
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isGlobal && <AppIcon name="trophy" size={14} />}
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
              style={{ position: 'absolute', top: '48px', left: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', zIndex: 10, minWidth: '210px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              <div onClick={() => { setPeriod('trimestral'); setOpen(false) }}
                style={{ padding: '12px 16px', cursor: 'pointer', background: period === 'trimestral' ? 'var(--color-primary-light)' : 'transparent', borderBottom: '0.5px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AppIcon name="trophy" size={14} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>Global</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Últimos 3 meses · Principal</div>
                  </div>
                  {period === 'trimestral' && <span style={{ marginLeft: 'auto', display: 'flex' }}><AppIcon name="check" size={12} color="var(--color-primary)" /></span>}
                </div>
              </div>
              <div style={{ padding: '6px 16px 2px', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Por período</div>
              {PERIODS.slice(1).map(p => (
                <div key={p.id} onClick={() => { setPeriod(p.id); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer', background: period === p.id ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                  <span style={{ fontSize: '13px', color: period === p.id ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: period === p.id ? 600 : 400 }}>{p.label}</span>
                  {period === p.id && <span style={{ display: 'flex' }}><AppIcon name="check" size={12} color="var(--color-text-muted)" /></span>}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SportDropdown({ selectedSports, toggleSport, onSelectAll, isTodos }) {
  const [open, setOpen] = useState(false)
  const label = isTodos ? 'Todos los deportes' : selectedSports.length === 1 ? selectedSports[0] : `${selectedSports.length} deportes`

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
                  {isTodos && <AppIcon name="check" size={10} color="#010906" />}
                </div>
                <span style={{ fontSize: '14px', fontWeight: isTodos ? 700 : 400, color: isTodos ? 'var(--color-primary)' : 'var(--color-text)' }}>Todos</span>
              </div>
              {SPORTS_LIST.map(sport => {
                const active = selectedSports.includes(sport)
                return (
                  <div key={sport} onClick={() => toggleSport(sport)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: active ? 'var(--color-primary-light)' : 'transparent' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, background: active ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <AppIcon name="check" size={10} color="#010906" />}
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

// ── Nou ranking per canal ──────────────────────────────────────────────────
const MIN_CH_BETS = 3

function useChannelRanking(channelType) {
  const [entries, setEntries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
    setEntries(null)

    const doFetch = async () => {
      if (!hasLoadedRef.current) setLoading(true)
      const safetyTimer = setTimeout(() => setLoading(false), 10000)
      try {
        const { data: channels } = await supabase
          .from('channels')
          .select('id, name, owner_id, avatar_url, channel_type, price, invite_code')
          .eq('channel_type', channelType)
          .is('deleted_at', null)
          .limit(200)

        if (!channels?.length) { setEntries([]); return }

        const channelIds = channels.map(c => c.id)
        const ownerIds = [...new Set(channels.map(c => c.owner_id))]

        const [betsRes, profilesRes, membersRes] = await Promise.all([
          supabase.from('bets')
            .select('channel_id, status, stake, odds, sport')
            .in('channel_id', channelIds)
            .in('status', ['won', 'lost'])
            .limit(5000),
          supabase.from('profiles')
            .select('id, username, avatar_url, is_verified')
            .in('id', ownerIds),
          supabase.from('channel_members')
            .select('channel_id')
            .in('channel_id', channelIds),
        ])

        const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))

        const memberCounts = {}
        for (const m of (membersRes.data || [])) {
          memberCounts[m.channel_id] = (memberCounts[m.channel_id] || 0) + 1
        }

        const betsByChannel = {}
        for (const b of (betsRes.data || [])) {
          if (!betsByChannel[b.channel_id]) betsByChannel[b.channel_id] = []
          betsByChannel[b.channel_id].push(b)
        }

        const result = channels.map(c => {
          const bets = betsByChannel[c.id] || []
          if (bets.length < MIN_CH_BETS) return null

          const won = bets.filter(b => b.status === 'won').length
          const lost = bets.filter(b => b.status === 'lost').length
          const profit = bets.reduce((s, b) => s + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake), 0)
          const stakeSum = bets.reduce((s, b) => s + b.stake, 0)
          const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
          const avgOdds = bets.length > 0 ? bets.reduce((s, b) => s + b.odds, 0) / bets.length : 0
          const winRate = bets.length > 0 ? (won / bets.length) * 100 : 0

          // Sport dominant del canal per al filtre de la sidebar
          const sportCounts = {}
          for (const b of bets) if (b.sport) sportCounts[b.sport] = (sportCounts[b.sport] || 0) + 1
          const mainSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

          const profile = profileMap[c.owner_id]
          // Score bayesià: penalitza mostres petites encertant moltes seguides
          // K=25 → 4 picks@24% score 3.3% vs 40 picks@6% score 3.7% (mostra gran guanya)
          const reliabilityScore = yieldVal * (bets.length / (bets.length + 25))
          return {
            channelId: c.id,
            channelName: c.name,
            channelType: c.channel_type,
            channelAvatarUrl: c.avatar_url,
            inviteCode: c.invite_code,
            price: c.price,
            ownerId: c.owner_id,
            ownerUsername: profile?.username ?? '—',
            ownerAvatarUrl: profile?.avatar_url,
            isVerified: profile?.is_verified || false,
            picks: bets.length,
            won, lost,
            yieldVal,
            reliabilityScore,
            avgOdds: avgOdds.toFixed(2),
            winRate,
            memberCount: memberCounts[c.id] || 0,
            mainSport,
          }
        }).filter(Boolean).sort((a, b) => b.reliabilityScore - a.reliabilityScore)

        setEntries(result)
        setLastUpdated(new Date())
      } catch {
        setEntries([])
      } finally {
        clearTimeout(safetyTimer)
        hasLoadedRef.current = true
        setLoading(false)
      }
    }

    doFetch()
    const interval = setInterval(doFetch, 300000)
    return () => clearInterval(interval)
  }, [channelType])

  return { entries, loading, lastUpdated }
}

// ── Helpers de presentació ─────────────────────────────────────────────────
function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

function ChannelAvatar({ avatarUrl, name, size = 36 }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : '?'
  if (avatarUrl) return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.33), fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function WinBar({ rate, color }) {
  return (
    <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, rate))}%`, background: color, borderRadius: '2px' }} />
    </div>
  )
}

const RANK_STYLE = {
  0: { border: 'rgba(251,191,36,0.5)',  bg: 'rgba(251,191,36,0.04)',  accent: '#fbbf24', medal: '🥇' },
  1: { border: 'rgba(148,163,184,0.4)', bg: 'rgba(148,163,184,0.03)', accent: '#94a3b8', medal: '🥈' },
  2: { border: 'rgba(180,107,74,0.4)',  bg: 'rgba(180,107,74,0.03)',  accent: '#b46b4a', medal: '🥉' },
}

const TH = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 10px', whiteSpace: 'nowrap' }
const TD = { padding: '14px 10px', verticalAlign: 'middle' }

// ── Taula unificada (totes les posicions) ─────────────────────────────────
function RankingTable({ entries, user, onNavigateToChannel }) {
  const openProfile = useProfileNav()

  if (!entries.length) return (
    <div className="empty-state">
      <div className="empty-icon"><AppIcon name="barChart" size={48} /></div>
      <div className="empty-title">Sin canales aún</div>
      <div className="empty-sub">No hay canales con suficientes picks resueltos para mostrar.</div>
    </div>
  )

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '52px' }} />
          <col />
          <col style={{ width: '90px' }} />
          <col style={{ width: '80px' }} />
          <col style={{ width: '72px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '62px' }} />
          <col style={{ width: '72px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: 'center' }}>POS</th>
            <th style={{ ...TH, textAlign: 'left' }}>CANAL</th>
            <th style={{ ...TH, textAlign: 'center' }}>YIELD</th>
            <th style={{ ...TH, textAlign: 'center' }}>% ACIERTO</th>
            <th style={{ ...TH, textAlign: 'center' }}>W/L</th>
            <th style={{ ...TH, textAlign: 'center' }}>CUOTA MEDIA</th>
            <th style={{ ...TH, textAlign: 'center' }}>PICKS</th>
            <th style={{ ...TH, textAlign: 'center' }}>MIEMBROS</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const yieldColor = e.yieldVal >= 5 ? 'var(--color-primary)' : e.yieldVal >= 0 ? 'var(--color-text)' : 'var(--color-error)'
            return (
              <tr key={e.channelId}
                style={{ borderTop: '0.5px solid var(--color-border)', transition: 'background 0.1s' }}
                onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>

                <td style={{ ...TD, textAlign: 'center' }}>
                  {i < 3
                    ? <span style={{ fontSize: '18px', lineHeight: 1 }}>{MEDALS[i]}</span>
                    : <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)' }}>#{i + 1}</span>
                  }
                </td>

                <td style={{ ...TD }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div onClick={() => e.inviteCode && onNavigateToChannel?.({ invite_code: e.inviteCode })}
                      style={{ flexShrink: 0, cursor: e.inviteCode ? 'pointer' : 'default' }}>
                      <ChannelAvatar avatarUrl={e.channelAvatarUrl} name={e.channelName} size={32} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                      <span onClick={() => e.inviteCode && onNavigateToChannel?.({ invite_code: e.inviteCode })}
                        style={{ fontSize: '14px', fontWeight: 700, cursor: e.inviteCode ? 'pointer' : 'default', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.channelName}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', flexShrink: 0 }}>·</span>
                      <div onClick={() => e.ownerId && openProfile?.(e.ownerId)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                        <Username username={e.ownerUsername} isVerified={e.isVerified} size="xs" />
                      </div>
                      {user?.id === e.ownerId && (
                        <span style={{ fontSize: '9px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: 'var(--radius-full)', fontWeight: 700, flexShrink: 0, border: '0.5px solid var(--color-primary-border)' }}>Tú</span>
                      )}
                    </div>
                  </div>
                </td>

                <td style={{ ...TD, textAlign: 'center', fontSize: '15px', fontWeight: 800, color: yieldColor, letterSpacing: '-0.5px' }}>
                  {e.yieldVal >= 0 ? '+' : ''}{e.yieldVal.toFixed(1)}%
                </td>

                <td style={{ ...TD, textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{e.winRate.toFixed(0)}%</span>
                    <div style={{ width: '44px' }}><WinBar rate={e.winRate} color={yieldColor} /></div>
                  </div>
                </td>

                <td style={{ ...TD, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {e.won}/{e.lost}
                </td>

                <td style={{ ...TD, textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>{e.avgOdds}</td>
                <td style={{ ...TD, textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>{e.picks}</td>
                <td style={{ ...TD, textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{formatCount(e.memberCount)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── PillSelect: dropdown estilitzat com a pastanya ─────────────────────────
function PillSelect({ value, onChange, options }) {
  const isDefault = value === options[0].value
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        background: isDefault ? 'var(--color-bg)' : 'var(--color-primary-light)',
        border: `0.5px solid ${isDefault ? 'var(--color-border)' : 'var(--color-primary)'}`,
        color: isDefault ? 'var(--color-text-muted)' : 'var(--color-primary)',
        fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: isDefault ? 400 : 700,
        padding: '5px 24px 5px 10px', borderRadius: 'var(--radius-full)',
        cursor: 'pointer', outline: 'none', WebkitAppearance: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23888' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        backgroundSize: '8px',
      }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Sidebar filtres ────────────────────────────────────────────────────────
function FiltersSidebar({ search, setSearch, sport, setSport, minYield, setMinYield, minPicks, setMinPicks, onlyVerified, setOnlyVerified, sortBy, setSortBy, lastUpdated, onClearFilters }) {
  const SPORT_OPTS = [
    { value: 'all', label: 'Todos los deportes' },
    ...SPORTS_LIST.map(s => ({ value: s, label: `${SPORT_ICONS[s]} ${s}` })),
  ]
  const YIELD_OPTS = [
    { value: '0',  label: 'Cualquier yield' },
    { value: '1',  label: 'Yield > 0%' },
    { value: '5',  label: 'Yield > 5%' },
    { value: '10', label: 'Yield > 10%' },
    { value: '20', label: 'Yield > 20%' },
  ]
  const PICKS_OPTS = [
    { value: '0',  label: 'Mín. apuestas' },
    { value: '5',  label: '≥ 5 apuestas' },
    { value: '10', label: '≥ 10 apuestas' },
    { value: '20', label: '≥ 20 apuestas' },
    { value: '50', label: '≥ 50 apuestas' },
  ]
  const SORT_OPTS = [
    { value: 'reliability', label: 'Fiabilidad' },
    { value: 'yield',       label: 'Yield' },
    { value: 'picks',       label: 'Picks' },
    { value: 'members',     label: 'Miembros' },
  ]
  const hasFilters = !!(search || sport !== 'all' || minYield !== '0' || minPicks !== '0' || onlyVerified || sortBy !== 'reliability')
  const lbl = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }

  return (
    <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '16px' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>Filtros</span>
        {hasFilters && (
          <button onClick={onClearFilters} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Limpiar
          </button>
        )}
      </div>

      <div>
        <div style={lbl}>Buscar</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Canal o tipster..."
          style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '7px 10px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div>
        <div style={lbl}>Deporte</div>
        <PillSelect value={sport} onChange={setSport} options={SPORT_OPTS} />
      </div>

      <div>
        <div style={lbl}>Yield mínimo</div>
        <PillSelect value={minYield} onChange={setMinYield} options={YIELD_OPTS} />
      </div>

      <div>
        <div style={lbl}>Apuestas mínimas</div>
        <PillSelect value={minPicks} onChange={setMinPicks} options={PICKS_OPTS} />
      </div>

      <div>
        <div style={lbl}>Ordenar por</div>
        <PillSelect value={sortBy} onChange={setSortBy} options={SORT_OPTS} />
        {sortBy === 'yield' && (
          <p style={{ margin: '6px 0 0', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Combina con «Apuestas mínimas» para filtrar muestras pequeñas.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>Solo verificados</span>
        <button onClick={() => setOnlyVerified(v => !v)}
          style={{ width: '36px', height: '20px', borderRadius: 'var(--radius-full)', flexShrink: 0, background: onlyVerified ? 'var(--color-primary)' : 'var(--color-border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: onlyVerified ? '19px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
        </button>
      </div>

      <div style={{ borderTop: '0.5px solid var(--color-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: lastUpdated ? 'var(--color-success)' : 'var(--color-border)', flexShrink: 0 }} />
          {lastUpdated ? `Act. ${lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Actualizando...'}
        </div>
      </div>
    </div>
  )
}

// ── Component principal ────────────────────────────────────────────────────
const SORT_LABELS = {
  reliability: 'Ordenado por fiabilidad (yield + muestra)',
  yield:       'Ordenado por yield',
  picks:       'Ordenado por picks resueltos',
  members:     'Ordenado por miembros',
}

export default function Ranking({ user, onNavigateToChannel }) {
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('all')
  const [minYield, setMinYield] = useState('0')
  const [minPicks, setMinPicks] = useState('0')
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [sortBy, setSortBy] = useState('reliability')

  const { entries, loading, lastUpdated } = useChannelRanking('public')

  const filtered = (entries || []).filter(e => {
    if (search && !e.channelName.toLowerCase().includes(search.toLowerCase()) && !e.ownerUsername.toLowerCase().includes(search.toLowerCase())) return false
    if (sport !== 'all' && e.mainSport !== sport) return false
    if (minYield !== '0' && e.yieldVal < Number(minYield)) return false
    if (minPicks !== '0' && e.picks < Number(minPicks)) return false
    if (onlyVerified && !e.isVerified) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'yield')   return b.yieldVal - a.yieldVal
    if (sortBy === 'picks')   return b.picks - a.picks
    if (sortBy === 'members') return b.memberCount - a.memberCount
    return b.reliabilityScore - a.reliabilityScore
  })

  const clearFilters = () => { setSearch(''); setSport('all'); setMinYield('0'); setMinPicks('0'); setOnlyVerified(false); setSortBy('reliability') }

  return (
    <motion.div key="ranking"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>

      {/* Capçalera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Ranking de canales</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {SORT_LABELS[sortBy]} · Mín. {MIN_CH_BETS} picks resueltos
          </p>
        </div>
        {!loading && entries !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--color-text-muted)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', flexShrink: 0 }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: lastUpdated ? 'var(--color-success)' : 'var(--color-border)' }} />
            {filtered.length} canal{filtered.length !== 1 ? 'es' : ''} clasificado{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Layout: contingut + sidebar */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {loading
              ? <div className="empty-state"><div className="empty-icon"><AppIcon name="loading" size={48} /></div><div>Cargando ranking...</div></div>
              : <RankingTable entries={filtered} user={user} onNavigateToChannel={onNavigateToChannel} />
            }
          </div>
        </div>

        <div style={{ width: '216px', flexShrink: 0 }}>
          <FiltersSidebar
            search={search} setSearch={setSearch}
            sport={sport} setSport={setSport}
            minYield={minYield} setMinYield={setMinYield}
            minPicks={minPicks} setMinPicks={setMinPicks}
            onlyVerified={onlyVerified} setOnlyVerified={setOnlyVerified}
            sortBy={sortBy} setSortBy={setSortBy}
            lastUpdated={lastUpdated}
            onClearFilters={clearFilters}
          />
        </div>

      </div>
    </motion.div>
  )
}
