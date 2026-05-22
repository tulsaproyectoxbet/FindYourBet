import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, stagger } from '../../lib/animations'
import { supabase } from '../../lib/supabase'
import { useProfileNav } from '../../contexts/ProfileNavContext'
import './dashboard.css'

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

function matchesSport(bet, sport) {
  if (sport === 'Otros') return !MAIN_SPORTS.includes(bet.sport)
  return bet.sport === sport
}

function getBestCombination(userBets, selectedSports) {
  const validSports = selectedSports.filter(sport => {
    const sportBets = userBets.filter(b => matchesSport(b, sport) && b.status !== 'pending')
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
      // Exclou picks suspesos o invalidats — no compten fins que l'admin els validi
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

    // Premium = canal privat amb almenys una offer activa. Els canals privats
    // sense offer són "invite-only" i NO han d'aparèixer al ranking premium.
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
          const resolved = userBets.filter(b => b.status !== 'pending')
          if (resolved.length < MIN_BETS) return null
          finalBets = userBets
          usedSports = null
        } else {
          const best = getBestCombination(userBets, selectedSports)
          if (!best) return null
          finalBets = best.bets
          usedSports = best.sports
        }

        const resolved = finalBets.filter(b => b.status !== 'pending')
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
      .from('profiles').select('id, username, hide_from_ranking').in('id', userIds)

    const profileMap = {}
    const hiddenSet = new Set()
    profiles?.forEach(p => {
      if (p.hide_from_ranking) hiddenSet.add(p.id)
      else profileMap[p.id] = p.username
    })

    setRanking(
      entries
        .filter(e => !hiddenSet.has(e.userId))
        .map(e => ({ ...e, username: profileMap[e.userId] ?? e.userId.slice(0, 6) }))
    )
    } catch (e) {
      // silent — no bloqueja la UI
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
  const isAmigos = period === 'amigos'
  const isSpecial = isGlobal || isAmigos
  const icon = isAmigos ? '👥' : isGlobal ? '🏆' : null

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          background: isSpecial ? 'var(--color-primary-light)' : 'var(--color-bg-soft)',
          border: isSpecial ? '1.5px solid var(--color-primary)' : '0.5px solid var(--color-border)',
          color: isSpecial ? 'var(--color-primary)' : 'var(--color-text)',
          fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700,
          padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px', justifyContent: 'space-between'
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon && <span style={{ fontSize: '12px' }}>{icon}</span>}
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

              {/* Global */}
              <div onClick={() => { setPeriod('trimestral'); setOpen(false) }}
                style={{ padding: '12px 16px', cursor: 'pointer', background: period === 'trimestral' ? 'var(--color-primary-light)' : 'transparent', borderBottom: '0.5px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>🏆</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>Global</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Últimos 3 meses · Principal</div>
                  </div>
                  {period === 'trimestral' && (
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-primary)' }}>✓</span>
                  )}
                </div>
              </div>

              {/* Amigos */}
              <div onClick={() => { setPeriod('amigos'); setOpen(false) }}
                style={{ padding: '12px 16px', cursor: 'pointer', background: period === 'amigos' ? 'var(--color-primary-light)' : 'transparent', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>👥</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>Amigos</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>Solo personas que sigues mutuamente</div>
                  </div>
                  {period === 'amigos' && (
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-primary)' }}>✓</span>
                  )}
                </div>
              </div>

              {/* Por período */}
              <div style={{ padding: '6px 16px 2px', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Por período
              </div>

              {PERIODS.slice(2).map(p => (
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

export function SportDropdown({ selectedSports, toggleSport, onSelectAll, isTodos }) {
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

// Hook per al ranking de canals VIP (mensuals o setmanals).
// Agrupa les apostes per channel_id i calcula stats per canal.
// Mín. 5 picks resolts per aparèixer (menys que el rànking públic perquè els VIP
// solen tenir menys volum però tots pagats → mostra valor ràpidament).
const MIN_VIP_BETS = 5
function useVipRanking(vipType) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        // 1. Obté tots els canals VIP del tipus seleccionat
        const { data: channels } = await supabase
          .from('channels')
          .select('id, name, owner_id, price, avatar_url')
          .eq('channel_type', vipType)
          .is('deleted_at', null)

        if (!channels?.length) { setRanking([]); setLoading(false); return }

        const channelIds = channels.map(c => c.id)
        const ownerIds = [...new Set(channels.map(c => c.owner_id))]

        // 2. Obté les apostes d'aquests canals i els perfils dels propietaris
        const [{ data: bets }, { data: profiles }] = await Promise.all([
          supabase.from('bets')
            .select('channel_id, status, stake, odds')
            .in('channel_id', channelIds)
            .in('status', ['won', 'lost'])
            .limit(2000),
          supabase.from('profiles')
            .select('id, username, avatar_url')
            .in('id', ownerIds),
        ])

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

        // 3. Agrupa per canal i calcula mètriques
        const byChannel = {}
        for (const b of bets || []) {
          if (!byChannel[b.channel_id]) byChannel[b.channel_id] = []
          byChannel[b.channel_id].push(b)
        }

        const entries = channels.map(c => {
          const channelBets = byChannel[c.id] || []
          if (channelBets.length < MIN_VIP_BETS) return null
          const won = channelBets.filter(b => b.status === 'won').length
          const lost = channelBets.filter(b => b.status === 'lost').length
          const { profit, stakeSum } = channelBets.reduce(
            (acc, b) => ({
              stakeSum: acc.stakeSum + b.stake,
              profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake),
            }),
            { profit: 0, stakeSum: 0 }
          )
          const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
          const avgOdds = channelBets.length > 0
            ? (channelBets.reduce((s, b) => s + b.odds, 0) / channelBets.length).toFixed(2)
            : '—'
          const winRate = channelBets.length > 0 ? (won / channelBets.length) * 100 : 0
          const profile = profileMap[c.owner_id]
          return { channelId: c.id, channelName: c.name, price: c.price, ownerId: c.owner_id, username: profile?.username ?? '?', bets: channelBets.length, won, lost, yieldVal, avgOdds, winRate }
        }).filter(Boolean).sort((a, b) => b.yieldVal - a.yieldVal)

        setRanking(entries)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [vipType])

  return { ranking, loading }
}

// Hook per al ranking de Stakazos — agrupa per tipster (owner_id) a través de
// tots els seus canals de tipus 'stakazo'. No és un ranking de canals sinó de
// l'historial acumulat del tipster venent picks puntuals.
function useStakazoRanking() {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data: channels } = await supabase
          .from('channels')
          .select('id, owner_id')
          .eq('channel_type', 'stakazo')
          .is('deleted_at', null)

        if (!channels?.length) { setRanking([]); setLoading(false); return }

        const channelIds = channels.map(c => c.id)
        const channelOwnerMap = Object.fromEntries(channels.map(c => [c.id, c.owner_id]))
        const ownerIds = [...new Set(channels.map(c => c.owner_id))]

        const [{ data: bets }, { data: profiles }] = await Promise.all([
          supabase.from('bets')
            .select('channel_id, status, stake, odds')
            .in('channel_id', channelIds)
            .in('status', ['won', 'lost'])
            .limit(2000),
          supabase.from('profiles')
            .select('id, username')
            .in('id', ownerIds),
        ])

        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

        // Agrupa apostes per tipster (owner_id del canal)
        const byOwner = {}
        for (const b of bets || []) {
          const ownerId = channelOwnerMap[b.channel_id]
          if (!ownerId) continue
          if (!byOwner[ownerId]) byOwner[ownerId] = []
          byOwner[ownerId].push(b)
        }

        const entries = Object.entries(byOwner).map(([ownerId, ownerBets]) => {
          if (ownerBets.length === 0) return null
          const won = ownerBets.filter(b => b.status === 'won').length
          const lost = ownerBets.filter(b => b.status === 'lost').length
          const winRate = (won / ownerBets.length) * 100
          const avgOdds = (ownerBets.reduce((s, b) => s + b.odds, 0) / ownerBets.length).toFixed(2)
          // Benefici mig per comprador: profit per pick / nombre de stakazos venuts
          const totalProfit = ownerBets.reduce(
            (acc, b) => acc + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake), 0
          )
          const avgProfit = ownerBets.length > 0 ? (totalProfit / ownerBets.length).toFixed(2) : '0'
          return { ownerId, username: profileMap[ownerId]?.username ?? '?', bets: ownerBets.length, won, lost, winRate, avgOdds, avgProfit }
        }).filter(Boolean).sort((a, b) => b.winRate - a.winRate || b.bets - a.bets)

        setRanking(entries)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  return { ranking, loading }
}

// Component reutilitzable per als rows del ranking VIP i Stakazo
function RankRow({ pos, left, right }) {
  return (
    <motion.div className="ranking-item" variants={fadeUp} layout whileHover={{ x: 4, transition: { duration: 0.2 } }}>
      <div className={`rank-pos ${pos === 0 ? 'top1' : pos === 1 ? 'top2' : pos === 2 ? 'top3' : ''}`}>#{pos + 1}</div>
      <div className="tipster-info-rank" style={{ flex: 1 }}>{left}</div>
      <div className="rank-metrics">{right}</div>
    </motion.div>
  )
}

function VipRankingTab({ vipType, user, openProfile }) {
  const { ranking, loading } = useVipRanking(vipType)
  const label = vipType === 'vip_monthly' ? 'mensual' : 'semanal'

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
  if (!ranking.length) return (
    <div className="empty-state">
      <div className="empty-icon">📅</div>
      <div className="empty-title">Sin datos aún</div>
      <div className="empty-sub">Los canales VIP {label}es necesitan mín. {MIN_VIP_BETS} picks resueltos para aparecer.</div>
    </div>
  )
  return (
    <motion.div className="ranking-list" initial="hidden" animate="visible" variants={stagger}>
      {ranking.map((t, i) => (
        <RankRow key={t.channelId} pos={i}
          left={
            <>
              <div className="tipster-name-rank" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span onClick={() => openProfile(t.ownerId)} style={{ cursor: 'pointer' }}>{t.channelName}</span>
                {t.price && <span style={{ fontSize: '10px', color: 'var(--color-warning)', background: 'rgba(245,158,11,0.12)', border: '0.5px solid rgba(245,158,11,0.3)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>{t.price}€/{label === 'mensual' ? 'mes' : 'sem'}</span>}
                {user?.id === t.ownerId && <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Tu</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                {t.username} · {t.bets} picks resueltos
              </div>
            </>
          }
          right={
            <>
              <div className="rank-metric">
                <div className={`rank-metric-val ${t.yieldVal >= 0 ? '' : 'red'}`}>{t.yieldVal >= 0 ? '+' : ''}{t.yieldVal.toFixed(1)}%</div>
                <div className="rank-metric-label">Yield</div>
              </div>
              <div className="rank-metric">
                <div className="rank-metric-val neutral">{t.won}/{t.lost}</div>
                <div className="rank-metric-label">W/L</div>
              </div>
              <div className="rank-metric">
                <div className="rank-metric-val neutral">{t.winRate.toFixed(0)}%</div>
                <div className="rank-metric-label">Acierto</div>
              </div>
              <div className="rank-metric">
                <div className="rank-metric-val neutral">{t.avgOdds}</div>
                <div className="rank-metric-label">Cuota</div>
              </div>
            </>
          }
        />
      ))}
    </motion.div>
  )
}

function StakazoRankingTab({ user, openProfile }) {
  const { ranking, loading } = useStakazoRanking()

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando...</div></div>
  if (!ranking.length) return (
    <div className="empty-state">
      <div className="empty-icon">⚡</div>
      <div className="empty-title">Sin datos aún</div>
      <div className="empty-sub">El historial de Stakazos aparecerá aquí cuando los tipsters resuelvan sus picks.</div>
    </div>
  )
  return (
    <motion.div className="ranking-list" initial="hidden" animate="visible" variants={stagger}>
      {ranking.map((t, i) => (
        <RankRow key={t.ownerId} pos={i}
          left={
            <>
              <div className="tipster-name-rank" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span onClick={() => openProfile(t.ownerId)} style={{ cursor: 'pointer' }}>{t.username}</span>
                {user?.id === t.ownerId && <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Tu</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>{t.bets} stakazos · beneficio mínimo promedio/pick</div>
            </>
          }
          right={
            <>
              <div className="rank-metric">
                <div className="rank-metric-val">{t.winRate.toFixed(0)}%</div>
                <div className="rank-metric-label">Acierto</div>
              </div>
              <div className="rank-metric">
                <div className="rank-metric-val neutral">{t.won}/{t.lost}</div>
                <div className="rank-metric-label">W/L</div>
              </div>
              <div className="rank-metric">
                <div className="rank-metric-val neutral">{t.avgOdds}</div>
                <div className="rank-metric-label">Cuota</div>
              </div>
              <div className="rank-metric">
                <div className={`rank-metric-val ${parseFloat(t.avgProfit) >= 0 ? '' : 'red'}`}>{parseFloat(t.avgProfit) >= 0 ? '+' : ''}{t.avgProfit}u</div>
                <div className="rank-metric-label">Profit/pick</div>
              </div>
            </>
          }
        />
      ))}
    </motion.div>
  )
}

// Sub-pestanyes del bloc Privado
const PRIVATE_SUBTABS = [
  { id: 'vip_monthly', label: '📅 VIP Mensual' },
  { id: 'vip_weekly',  label: '📅 VIP Semanal' },
  { id: 'stakazo',     label: '⚡ Stakazos' },
]

export default function Ranking({ user }) {
  const openProfile = useProfileNav()
  // bloc: 'public' | 'private' — els 2 grans blocs del ranking
  const [bloc, setBloc] = useState('public')
  // subTab: sub-pestanya dins del bloc Privado
  const [subTab, setSubTab] = useState('vip_monthly')
  const [period, setPeriod] = useState('trimestral')
  const [selectedSports, setSelectedSports] = useState([])
  const [hideMe, setHideMe] = useState(false)
  // El ranking públic s'obté per tipster. El privat té els seus propis hooks
  // (per canal VIP o per tipster acumulat de stakazos).
  const { ranking, loading } = useRanking(period, selectedSports, 'public')

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('hide_from_ranking').eq('id', user.id).single()
      .then(({ data }) => { if (data) setHideMe(data.hide_from_ranking ?? false) })
  }, [user?.id])

  const toggleHideMe = async () => {
    const next = !hideMe
    setHideMe(next)
    await supabase.from('profiles').update({ hide_from_ranking: next }).eq('id', user.id)
  }

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
        <p>Clasificación de tipsters y canales por rendimiento.</p>
      </div>

      {/* Selector principal: Público / Privado */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
        {[
          { id: 'public',  label: '🌐 Público' },
          { id: 'private', label: '🔒 Privado' },
        ].map(b => (
          <button key={b.id} onClick={() => setBloc(b.id)}
            style={{ padding: '9px 22px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-sans)', background: bloc === b.id ? 'var(--color-primary)' : 'transparent', color: bloc === b.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ── BLOC PÚBLIC ── */}
      {bloc === 'public' && (
        <>
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
            Mín. {MIN_BETS} apuestas resueltas · Mostrando: <strong style={{ color: 'var(--color-text)' }}>{periodLabel}</strong>
            {!isTodos && <> · <strong style={{ color: 'var(--color-primary)' }}>{selectedSports.join(' + ')}</strong></>}
          </div>

          {loading ? (
            <div className="empty-state"><div className="empty-icon">⏳</div><div>Cargando ranking...</div></div>
          ) : ranking.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏆</div>
              <div className="empty-title">Sin datos para este filtro</div>
              <div className="empty-sub">Prueba con otro período o deporte.</div>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div className="ranking-list" initial="hidden" animate="visible" variants={stagger}>
                {ranking.map((t, i) => (
                  <motion.div key={t.userId} className="ranking-item" variants={fadeUp}
                    layout whileHover={{ x: 4, transition: { duration: 0.2 } }}>
                    <div className={`rank-pos ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}`}>#{i + 1}</div>
                    <div className="tipster-info-rank">
                      <div className="tipster-name-rank" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span onClick={() => openProfile(t.userId)} style={{ cursor: 'pointer' }}>{t.username}</span>
                        {user?.id === t.userId && (
                          <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Tu</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span className="tipster-user-rank" style={{ margin: 0 }}>{t.bets} apuestas resueltas</span>
                        {t.usedSports?.map(s => (
                          <span key={s} style={{ fontSize: '10px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '1px 7px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            {SPORT_ICONS[s]} {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rank-metrics">
                      <div className="rank-metric">
                        <div className={`rank-metric-val ${t.yieldVal >= 0 ? '' : 'red'}`}>{t.yieldVal >= 0 ? '+' : ''}{t.yieldVal.toFixed(1)}%</div>
                        <div className="rank-metric-label">Yield</div>
                      </div>
                      <div className="rank-metric">
                        <div className="rank-metric-val neutral">{t.won}/{t.lost}</div>
                        <div className="rank-metric-label">W/L</div>
                      </div>
                      <div className="rank-metric">
                        <div className="rank-metric-val neutral">{t.avgOdds}</div>
                        <div className="rank-metric-label">Cuota</div>
                      </div>
                      <div className="rank-metric">
                        <div className="rank-metric-val neutral">{t.habitualStake}</div>
                        <div className="rank-metric-label">Stake<br/>usual</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}

      {/* ── BLOC PRIVAT ── sub-pestanyes VIP Mensual / VIP Semanal / Stakazos */}
      {bloc === 'private' && (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '0.5px solid var(--color-border)', paddingBottom: '0' }}>
            {PRIVATE_SUBTABS.map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                style={{ padding: '8px 16px', border: 'none', borderBottom: `2px solid ${subTab === t.id ? 'var(--color-primary)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: subTab === t.id ? 700 : 500, fontFamily: 'var(--font-sans)', color: subTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          {subTab === 'vip_monthly' && <VipRankingTab vipType="vip_monthly" user={user} openProfile={openProfile} />}
          {subTab === 'vip_weekly'  && <VipRankingTab vipType="vip_weekly"  user={user} openProfile={openProfile} />}
          {subTab === 'stakazo'     && <StakazoRankingTab user={user} openProfile={openProfile} />}
        </>
      )}

    </motion.div>
  )
}