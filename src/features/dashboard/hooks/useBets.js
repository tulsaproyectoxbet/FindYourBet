import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

const EMPTY_FORM = {
  event: '', pick: '', odds: '', stake: 5,
  date: '', sport: 'Fútbol', market: '1X2', analysis: '',
  channelIds: []
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
  const resolved = bets.filter(b => b.status !== 'pending')
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
  const avgOdds = bets.length > 0
    ? (bets.reduce((s, b) => s + b.odds, 0) / bets.length).toFixed(2)
    : '—'
  return { won, lost, yieldVal, avgOdds }
}

export function hasMatchStarted(bet) {
  if (!bet.date) return false
  return new Date(bet.date) <= new Date()
}

// Envia l'aposta als canals seleccionats com a missatge especial
async function sendBetToChannels(bet, channelIds) {
  if (!channelIds || channelIds.length === 0) return
  const content = `[BET]:${JSON.stringify({
    id: bet.id,
    event: bet.event,
    pick: bet.pick,
    odds: bet.odds,
    stake: bet.stake,
    sport: bet.sport,
    market: bet.market,
    date: bet.date,
    status: bet.status
  })}`
  await Promise.all(channelIds.map(channelId =>
    supabase.from('channel_messages').insert({
      channel_id: channelId,
      user_id: bet.user_id,
      content
    })
  ))
}

export function useBets(user) {
  const [bets, setBets] = useState([])
  const [loadingBets, setLoadingBets] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [period, setPeriod] = useState('total')

  useEffect(() => {
    if (!user?.id || user.id === 'dev-skip') { setLoadingBets(false); return }
    fetchBets()
  }, [user])

  const fetchBets = async () => {
    setLoadingBets(true)
    const { data, error } = await supabase
      .from('bets').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setBets(data || [])
    setLoadingBets(false)
  }

  const submitBet = async (preselectedChannelId = null) => {
    if (!form.event || !form.pick || !form.odds || !form.date) {
      alert('Rellena todos los campos obligatorios'); return
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

    const newBet = {
      user_id: user.id, event: form.event, pick: form.pick,
      odds: parseFloat(form.odds), stake: form.stake, date: form.date,
      sport: form.sport, market: form.market, analysis: form.analysis,
      status: 'pending', channel_ids: channelIds
    }
    const { data, error } = await supabase.from('bets').insert(newBet).select()
    if (!error && data?.[0]) {
      setBets(prev => [data[0], ...prev])
      await sendBetToChannels(data[0], channelIds)
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

  const filteredBets = filterBetsByPeriod(bets, period)
  const { won, lost, yieldVal, avgOdds } = calcStats(filteredBets)

  return {
    bets: filteredBets, allBets: bets, loadingBets, showModal, setShowModal,
    form, setForm, submitBet, resolveBet, deleteBet,
    won, lost, yieldVal, avgOdds,
    period, setPeriod
  }
}