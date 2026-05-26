import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const EMPTY_FORM = {
  event: '', pick: '', odds: '', stake: 5,
  date: '', sport: 'Fútbol', market: '1X2', analysis: '',
  channelIds: [], bookie: '', betImageUrl: ''
}

// Converts a datetime-local string to ISO 8601 with local timezone offset
// Avoids UTC↔local roundtrip errors when Supabase stores as timestamp without tz
function toLocalISOString(localDateStr) {
  const dt = new Date(localDateStr)
  const pad = n => String(n).padStart(2, '0')
  const offset = -dt.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(offset) / 60))
  const om = pad(Math.abs(offset) % 60)
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00${sign}${oh}:${om}`
}

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
  if (period === 'mensual') return { start: new Date(year, month, 1, 0, 0, 0), end: new Date(year, month + 1, 0, 23, 59, 59) }
  if (period === 'anual') return { start: new Date(year, 0, 1, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59) }
  if (period === 'trimestral') {
    const threeMonthsAgo = new Date(now)
    threeMonthsAgo.setMonth(now.getMonth() - 3)
    threeMonthsAgo.setHours(0, 0, 0, 0)
    return { start: threeMonthsAgo, end: now }
  }
  return null
}

function filterBetsByPeriod(bets, period) {
  if (period === 'total') return bets
  const range = getPeriodRange(period)
  if (!range) return bets
  return bets.filter(b => {
    const betDate = new Date(b.date)
    return betDate >= range.start && betDate <= range.end
  })
}

function calcStats(bets) {
  // 'void' = pick nul (anul·lat, diners retornats) — exclòs de TOTES les estadístiques
  const resolved = bets.filter(b => b.status === 'won' || b.status === 'lost')
  const won = bets.filter(b => b.status === 'won')
  const lost = bets.filter(b => b.status === 'lost')
  let yieldVal = 0
  if (resolved.length > 0) {
    const totals = resolved.reduce(
      (acc, b) => ({
        stakeSum: acc.stakeSum + b.stake,
        profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
      }),
      { profit: 0, stakeSum: 0 }
    )
    yieldVal = totals.stakeSum > 0 ? (totals.profit / totals.stakeSum) * 100 : 0
  }
  // avg odds: només counted (no pending, no void) — perquè els nuls no afectin l'estadística
  const counted = bets.filter(b => b.status === 'won' || b.status === 'lost')
  const avgOdds = counted.length > 0
    ? (counted.reduce((s, b) => s + b.odds, 0) / counted.length).toFixed(2)
    : '—'
  return { won, lost, yieldVal, avgOdds }
}

export function hasMatchStarted(bet) {
  if (!bet.date) return false
  return new Date(bet.date) <= new Date()
}

async function sendBetToChannels(bet, channelIds, localDate) {
  if (!channelIds || channelIds.length === 0) return
  const content = `[BET]:${JSON.stringify({
    id: bet.id,
    event: bet.event,
    pick: bet.pick,
    odds: bet.odds,
    stake: bet.stake,
    sport: bet.sport,
    market: bet.market,
    date: localDate || bet.date,
    status: bet.status,
    bookie: bet.bookie || null,
    imageUrl: bet.bet_image_url || null,
  })}`
  const sentAt = bet.created_at || new Date().toISOString()
  await Promise.all(channelIds.map(channelId =>
    supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: bet.user_id,
      content,
      created_at: sentAt
    })
  ))
}

export function useBets(user) {
  const [bets, setBets] = useState([])
  const [loadingBets, setLoadingBets] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [period, setPeriod] = useState('total')

  // Depèn de user?.id, no de l'objecte user. Evita refetches amb flash de loading
  // a cada esdeveniment de Supabase (SIGNED_IN, USER_UPDATED, TOKEN_REFRESHED, etc.)
  useEffect(() => {
    if (!user?.id || user.id === 'dev-skip') { setLoadingBets(false); return }
    fetchBets()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBets = async () => {
    // Safety net per si Supabase es penja
    const safetyTimer = setTimeout(() => setLoadingBets(false), 10000)
    try {
      const { data, error } = await supabase
        .from('bets').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error) setBets(data || [])
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setLoadingBets(false)
    }
  }

  const submitBet = async (preselectedChannelId = null) => {
    const isPhotoMode = !!form.betImageUrl

    if (isPhotoMode) {
      if (!form.odds || !form.date) {
        alert('Rellena la cuota y la fecha'); return
      }
    } else {
      if (!form.event || !form.pick || !form.odds || !form.date) {
        alert('Rellena todos los campos obligatorios'); return
      }
    }

    if (new Date(form.date) <= new Date()) {
      alert('La fecha y hora del evento debe ser futura'); return
    }

    const channelIds = preselectedChannelId
      ? [preselectedChannelId]
      : form.channelIds

    if (!channelIds || channelIds.length === 0) {
      alert('Selecciona al menos un canal para publicar la apuesta'); return
    }

    const { data: ch } = await supabase
      .from('channels')
      .select('id, is_private')
      .in('id', channelIds)
    const allPrivate = (ch || []).length > 0 && ch.every(c => c.is_private)

    const newBet = {
      user_id: user.id,
      event: isPhotoMode ? '📷 Pick fotográfico' : form.event,
      pick: isPhotoMode ? '-' : form.pick,
      odds: parseFloat(form.odds),
      stake: form.stake,
      date: toLocalISOString(form.date),
      sport: isPhotoMode ? 'Otros' : form.sport,
      market: isPhotoMode ? 'Otro' : form.market,
      analysis: form.analysis,
      status: 'pending',
      channel_ids: channelIds,
      channel_id: channelIds[0],
      was_private: allPrivate,
      bookie: form.bookie || null,
      bet_image_url: form.betImageUrl || null,
    }
    const { data, error } = await supabase.from('bets').insert(newBet).select()
    if (!error && data?.[0]) {
      setBets(prev => [data[0], ...prev])
      await sendBetToChannels(data[0], channelIds, form.date)
    }
    setShowModal(false)
    setForm(EMPTY_FORM)
  }

  const resolveBet = async (id, result) => {
    const { error } = await supabase.from('bets').update({ status: result }).eq('id', id)
    if (!error) setBets(prev => prev.map(b => b.id === id ? { ...b, status: result } : b))
  }

  const deleteBet = async (id) => {
    const { error } = await supabase.from('bets').delete().eq('id', id)
    if (!error) setBets(prev => prev.filter(b => b.id !== id))
  }

  const updateBet = async (id, updates) => {
    const { error } = await supabase.from('bets').update(updates).eq('id', id)
    if (!error) setBets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    return { error }
  }

  const filteredBets = filterBetsByPeriod(bets, period)
  const { won, lost, yieldVal, avgOdds } = calcStats(filteredBets)

  return {
    bets: filteredBets, allBets: bets, loadingBets, showModal, setShowModal,
    form, setForm, submitBet, resolveBet, deleteBet, updateBet,
    won, lost, yieldVal, avgOdds,
    period, setPeriod
  }
}