import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import Username, { VerifiedBadge } from '../../../components/ui/Username'
import { isAdminUserId } from '../../../lib/adminUsers'
import { useAdminMode } from '../../../contexts/AdminModeContext'
import { useMessages } from './hooks/useMessages'
import { StickerPicker } from '../StickerPicker'
import { VoiceRecordButton } from '../VoiceMessage'
import ProfileView from '../social/ProfileView'
import OfferManager from '../payments/OfferManager'
import ForwardModal from '../social/ForwardModal'
import {
  parseBetMessage, parsePollMessage,
  renderMessage, parseForward, parseReply, parseEdited, parsePinnedValue,
  isBetMessage, isImageMessage, isStickerMessage, isProfileMessage, isVoiceMessage, isPollMessage,
  isImgTextMessage, parseImgTextMessage, ImageMessage,
  formatMsgTime, getDayLabel, DaySeparator,
} from './messageRenderer'

function readableContent(content) {
  if (content?.startsWith('[IMG_MSG]:')) {
    try { return parseImgTextMessage(content)?.text || '📷 Imagen' } catch { return '📷 Imagen' }
  }
  return content ?? ''
}
import PinDurationModal from './PinDurationModal'
import PostModal from '../feed/PostModal'
import ChannelBetPost from './ChannelBetPost'
import PollCard from './PollCard'
import PollCreatorModal from './PollCreatorModal'
import { insertNotification } from '../notifications/useNotifications'

function isLinkMessage(content) { return content.startsWith('http://') || content.startsWith('https://') }

// liveStatuses: map { betId → status } amb l'estat actual de la BD
// liveReviewStatuses: map { betId → review_status }
// Picks en 'review' o 'invalid' queden exclosos de les estadístiques del canal.
function calcChannelStats(messages, liveStatuses = {}, liveReviewStatuses = {}) {
  const betMessages = messages.filter(m => isBetMessage(m.content))
  const bets = betMessages.map(m => parseBetMessage(m.content)).filter(Boolean)
  // Substitueix l'status incrustat (sempre 'pending') pel de la BD si existeix
  const enriched = bets
    .map(b => ({ ...b, status: liveStatuses[b.id] ?? b.status, reviewStatus: liveReviewStatuses[b.id] ?? null }))
    // Exclou picks suspesos o invalidats de les estadístiques
    .filter(b => b.reviewStatus !== 'review' && b.reviewStatus !== 'invalid')
  // Només won/lost. 'void' (pick nul, diners retornats) no afecta cap stat.
  const resolved = enriched.filter(b => b.status === 'won' || b.status === 'lost')
  const won = enriched.filter(b => b.status === 'won').length
  const lost = enriched.filter(b => b.status === 'lost').length
  let yieldVal = 0
  if (resolved.length > 0) {
    const { profit, stakeSum } = resolved.reduce(
      (acc, b) => ({
        stakeSum: acc.stakeSum + b.stake,
        profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
      }),
      { profit: 0, stakeSum: 0 }
    )
    yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
  }
  const avgOdds = bets.length > 0
    ? (bets.reduce((s, b) => s + parseFloat(b.odds), 0) / bets.length).toFixed(2)
    : '—'
  return { total: bets.length, won, lost, yieldVal, avgOdds, resolved: resolved.length }
}

const FILTER_OPTIONS = [
  { key: 'week',    label: '7 días' },
  { key: 'month',   label: '1 mes' },
  { key: '3months', label: '3 meses' },
  { key: 'all',     label: 'Todo' },
]
const FILTER_DAYS = { week: 7, month: 30, '3months': 90, all: Infinity }
const START_BANK = 1000

function EstadisticasModal({ messages, liveStatuses, ownerUsername, channelName, onClose }) {
  const [filter, setFilter] = useState('month')

  const days = FILTER_DAYS[filter]

  const allRows = messages
    .filter(m => isBetMessage(m.content))
    .map(m => {
      const bet = parseBetMessage(m.content)
      if (!bet) return null
      const status = liveStatuses[bet.id] ?? bet.status
      return { ...bet, status, date: new Date(m.created_at) }
    })
    .filter(Boolean)
    .filter(r => {
      if (days === Infinity) return true
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      return r.date >= cutoff
    })
    .sort((a, b) => a.date - b.date)

  const { result: rowsAsc } = allRows.reduce(
    (acc, r) => {
      let profit = null
      let nextBank = acc.bank
      if (r.status === 'won') { profit = r.stake * (r.odds - 1); nextBank = acc.bank + profit }
      else if (r.status === 'lost') { profit = -r.stake; nextBank = acc.bank + profit }
      else if (r.status === 'void') { profit = 0 }
      return {
        bank: nextBank,
        result: [...acc.result, { ...r, profit, bankAfter: r.status === 'pending' ? null : nextBank }],
      }
    },
    { bank: START_BANK, result: [] }
  )
  const rows = rowsAsc.reverse()

  const resolved = allRows.filter(r => r.status === 'won' || r.status === 'lost')
  const won    = allRows.filter(r => r.status === 'won').length
  const lost   = allRows.filter(r => r.status === 'lost').length
  const voided = allRows.filter(r => r.status === 'void').length
  const { totalProfit, stakeSum } = resolved.reduce(
    (acc, r) => ({
      stakeSum: acc.stakeSum + (r.stake || 0),
      totalProfit: acc.totalProfit + (r.status === 'won' ? (r.stake || 0) * ((r.odds || 1) - 1) : -(r.stake || 0)),
    }),
    { totalProfit: 0, stakeSum: 0 }
  )
  const yieldVal   = stakeSum > 0 ? (totalProfit / stakeSum) * 100 : 0
  const pctAcierto = resolved.length > 0 ? (won / resolved.length) * 100 : 0
  const SUMMARY = [
    { label: 'Yield',     value: `${yieldVal >= 0 ? '+' : ''}${yieldVal.toFixed(1)}%`, color: yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' },
    { label: 'Ganadas',   value: won,                                                    color: 'var(--color-primary)' },
    { label: 'Perdidas',  value: lost,                                                   color: 'var(--color-error)' },
    { label: 'Nulas',     value: voided,                                                 color: 'var(--color-info)' },
    { label: 'Total',     value: allRows.length,                                         color: 'var(--color-text)' },
    { label: '% Acierto', value: `${pctAcierto.toFixed(0)}%`,                           color: 'var(--color-text)' },
  ]

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflowY: 'auto' }}
      onClick={onClose}>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '860px', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', border: '0.5px solid var(--color-border)', overflow: 'hidden', marginTop: '8px', marginBottom: '8px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--color-text)' }}>Tabla estadística</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {channelName} · @{ownerUsername}
            </div>
          </div>
          {/* Filtres de periode */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setFilter(opt.key)}
                style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: filter === opt.key ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: filter === opt.key ? '#010906' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {/* RESUM ESTADÍSTIC */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0', borderBottom: '0.5px solid var(--color-border)' }}>
          {SUMMARY.map((s, i) => (
            <div key={i} style={{ padding: '14px 16px', borderRight: i < 5 ? '0.5px solid var(--color-border)' : 'none', background: 'var(--color-bg-soft)' }}>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* TAULA */}
        {allRows.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Sin picks en este periodo
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-soft)', position: 'sticky', top: 0 }}>
                  {[
                    { h: '#',     align: 'center' },
                    { h: 'Fecha', align: 'left'   },
                    { h: 'Pick',  align: 'left'   },
                    { h: 'Stake', align: 'right'  },
                    { h: 'Cuota', align: 'right'  },
                    { h: 'Res.',  align: 'center' },
                    { h: '+/-',   align: 'right'  },
                  ].map(({ h, align }) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: align, fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap', borderBottom: '0.5px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isWon  = r.status === 'won'
                  const isLost = r.status === 'lost'
                  const isVoid = r.status === 'void'
                  const resColor = isWon ? 'var(--color-primary)' : isLost ? 'var(--color-error)' : isVoid ? 'var(--color-info)' : 'var(--color-text-muted)'
                  const resBg    = isWon ? 'var(--color-primary-light)' : isLost ? 'var(--color-error-light)' : isVoid ? 'var(--color-info-light)' : 'var(--color-bg-soft)'
                  const resLabel = isWon ? 'W' : isLost ? 'L' : isVoid ? 'N' : '⏳'
                  const profitStr   = r.profit === null ? '—' : r.profit > 0 ? `+${r.profit.toFixed(2)}u` : `${r.profit.toFixed(2)}u`
                  const profitColor = r.profit === null ? 'var(--color-text-muted)' : r.profit > 0 ? 'var(--color-primary)' : r.profit < 0 ? 'var(--color-error)' : 'var(--color-info)'
                  const num = rows.length - i
                  const dateStr = r.date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  const event = r.event || '—'
                  const pick  = r.pick  || ''
                  return (
                    <tr key={r.id || i} style={{ borderBottom: '0.5px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'var(--color-bg-soft)' }}>
                      <td style={{ padding: '9px 12px', color: 'var(--color-text-muted)', textAlign: 'center', fontSize: '11px' }}>{num}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--color-text)', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={event}>{event}</div>
                        {pick && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--color-text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.stake}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--color-warning)', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{parseFloat(r.odds || 0).toFixed(2)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{ background: resBg, color: resColor, border: `0.5px solid ${resColor}44`, borderRadius: '4px', padding: '3px 8px', fontWeight: 800, fontSize: '11px' }}>{resLabel}</span>
                      </td>
                      <td style={{ padding: '9px 12px', color: profitColor, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{profitStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {rows.length} picks
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>FindYourBet</div>
        </div>

      </motion.div>
    </motion.div>,
    document.body
  )
}

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '0.5px solid var(--color-border)' }}>{title}</div>
      {children}
    </div>
  )
}

function InfoToggle({ label, desc, active, onChange }) {
  return (
    <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', cursor: 'pointer' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{desc}</div>}
      </div>
      <div style={{ width: '36px', height: '20px', borderRadius: '999px', background: active ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: '2px', left: active ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </div>
    </div>
  )
}

function MemberRow({ profile, userId, isChannelOwner, isMemberAdmin, canKick, onKick, canPromote, onPromote, canDemote, onDemote, canBan, onBanClick, onViewProfile }) {
  const initial = (profile?.username || userId?.slice(0, 2) || '?')[0].toUpperCase()
  const [showMenu, setShowMenu] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid var(--color-border)' }}>
      <div onClick={() => onViewProfile?.(userId)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', cursor: onViewProfile ? 'pointer' : 'default', position: 'relative' }}>
        {initial}
        {profile?.avatar_url && (
          <img src={profile.avatar_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div onClick={() => onViewProfile?.(userId)} style={{ flex: 1, minWidth: 0, cursor: onViewProfile ? 'pointer' : 'default' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Username username={profile?.username || userId?.slice(0, 8) || '?'} isVerified={profile?.is_verified} size="sm" />
          {isChannelOwner && <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '0.5px solid rgba(245,158,11,0.3)' }}>Creador</span>}
          {isMemberAdmin && !isChannelOwner && <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '0.5px solid var(--color-primary-border)' }}>Admin</span>}
        </div>
      </div>
      {(canPromote || canDemote || canKick || canBan) && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setShowMenu(v => !v)}
            style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}>
            ···
          </button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 20, minWidth: '140px', overflow: 'hidden' }}>
                {canPromote && <button onClick={() => { onPromote(); setShowMenu(false) }} style={{ display: 'flex', width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>⬆ Hacer admin</button>}
                {canDemote && <button onClick={() => { onDemote(); setShowMenu(false) }} style={{ display: 'flex', width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>⬇ Quitar admin</button>}
                {canKick && <button onClick={() => { onKick(); setShowMenu(false) }} style={{ display: 'flex', width: '100%', padding: '9px 14px', background: 'none', border: 'none', borderBottom: canBan ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-error)', fontWeight: 600, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>🚪 Expulsar</button>}
                {canBan && <button onClick={() => { onBanClick({ userId, username: profile?.username || userId?.slice(0, 8) }); setShowMenu(false) }} style={{ display: 'flex', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-error)', fontWeight: 700, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>⛔ Vetar</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InfoView({ channel, messages, liveStatuses, isOwner, isAdmin, onClose, onUpdateChannel, onDeleteChannel, currentUser }) {
  const { adminMode } = useAdminMode()
  const [showEstadisticas, setShowEstadisticas] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: channel.name, description: channel.description || '' })
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  // Admin: eliminar canal amb motiu (visible només si adminMode i no ets owner)
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false)
  const [adminDeleteReason, setAdminDeleteReason] = useState('')
  const [adminDeleting, setAdminDeleting] = useState(false)

  const handleAdminDeleteChannel = async () => {
    if (!adminDeleteReason.trim()) { alert('Escribe el motivo'); return }
    setAdminDeleting(true)
    const { error } = await supabase.from('channels').update({
      deleted_at: new Date().toISOString(),
      deletion_reason: adminDeleteReason.trim(),
      deletion_notified: false,
    }).eq('id', channel.id)
    setAdminDeleting(false)
    if (error) { alert('Error: ' + error.message); return }
    setAdminDeleteOpen(false)
    alert('Canal eliminado.')
    onClose?.()
  }
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [banModal, setBanModal] = useState(null) // { userId, username }
  const [profileOverlay, setProfileOverlay] = useState(null) // userId
  const avatarInputRef = useRef(null)

  const stats = calcChannelStats(messages, liveStatuses)
  const images = messages.filter(m => isImageMessage(m.content))
  const links = messages.filter(m => isLinkMessage(m.content))

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    const [{ data: mems }, { data: ownerProf }] = await Promise.all([
      supabase.from('channel_members').select('user_id, joined_at, role').eq('channel_id', channel.id).order('joined_at', { ascending: true }),
      supabase.from('profiles').select('id, username, name, avatar_url, is_verified').eq('id', channel.owner_id).single(),
    ])
    setOwnerProfile(ownerProf)
    if (!mems?.length) { setLoadingMembers(false); return }
    const userIds = mems.map(m => m.user_id).filter(id => id !== channel.owner_id)
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, username, name, avatar_url, is_verified').in('id', userIds)
      : { data: [] }
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    // Filtra admins (fyourbet és invisible) i l'owner ja té la seva pròpia targeta
    setMembers(mems.filter(m => m.user_id !== channel.owner_id && !isAdminUserId(m.user_id)).map(m => ({ ...m, profile: profileMap[m.user_id] || null })))
    setLoadingMembers(false)
  }

  const handleSave = async () => {
    const newName = editForm.name.trim()
    if (!newName) return
    setSaving(true)
    setAvatarError('')

    // Nom únic per canals públics (no aplica si el nom no ha canviat)
    if (!channel.is_private && newName.toLowerCase() !== (channel.name || '').toLowerCase()) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: conflicts } = await supabase
        .from('channels')
        .select('id, owner_id, deleted_at')
        .eq('is_private', false)
        .ilike('name', newName)
        .neq('id', channel.id)
      const blocking = (conflicts || []).find(c => {
        if (!c.deleted_at) return true
        if (c.owner_id === channel.owner_id) return false
        if (c.deleted_at > sevenDaysAgo) return true
        return false
      })
      if (blocking) {
        setAvatarError('Ese nombre de canal ya está en uso')
        setSaving(false)
        return
      }
    }

    let avatarUrl = channel.avatar_url || null
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `channel-avatars/${channel.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('channel-files').upload(path, avatarFile, { upsert: true })
      if (uploadError) {
        setAvatarError(`Error foto: ${uploadError.message}`)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
      avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
    }
    await supabase.from('channels').update({ name: editForm.name.trim(), description: editForm.description.trim(), avatar_url: avatarUrl }).eq('id', channel.id)
    onUpdateChannel({ ...channel, name: editForm.name.trim(), description: editForm.description.trim(), avatar_url: avatarUrl })
    setSaving(false)
    setEditing(false)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const handleToggle = async (field) => {
    const newVal = !channel[field]
    await supabase.from('channels').update({ [field]: newVal }).eq('id', channel.id)
    onUpdateChannel({ ...channel, [field]: newVal })
  }

  const handleField = async (field, value) => {
    await supabase.from('channels').update({ [field]: value || null }).eq('id', channel.id)
    onUpdateChannel({ ...channel, [field]: value || null })
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://fyourbet.com/canal/${channel.invite_code}`)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleRegenerateCode = async () => {
    setRegenerating(true)
    const newCode = Math.random().toString(36).substring(2, 10).toLowerCase()
    await supabase.from('channels').update({ invite_code: newCode }).eq('id', channel.id)
    onUpdateChannel({ ...channel, invite_code: newCode })
    setRegenerating(false)
  }

  const handleKick = async (userId) => {
    await supabase.from('channel_members').delete().eq('channel_id', channel.id).eq('user_id', userId)
    setMembers(prev => prev.filter(m => m.user_id !== userId))
  }

  const handlePromote = async (userId) => {
    await supabase.from('channel_members').update({ role: 'admin' }).eq('channel_id', channel.id).eq('user_id', userId)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: 'admin' } : m))
  }

  const handleDemote = async (userId) => {
    await supabase.from('channel_members').update({ role: 'member' }).eq('channel_id', channel.id).eq('user_id', userId)
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: 'member' } : m))
  }

  const handleBan = async (userId, bannedUntil) => {
    await Promise.all([
      supabase.from('channel_bans').upsert({ channel_id: channel.id, user_id: userId, banned_by: channel.owner_id, banned_until: bannedUntil }),
      supabase.from('channel_members').delete().eq('channel_id', channel.id).eq('user_id', userId),
    ])
    setMembers(prev => prev.filter(m => m.user_id !== userId))
    setBanModal(null)
  }

  const avatarDisplay = avatarPreview || channel.avatar_url

  const inputSt = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '380px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflowY: 'auto', zIndex: 10, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: '15px' }}>Info del canal</div>
        {isOwner && (
          <button onClick={() => { setEditing(v => !v); setAvatarFile(null); setAvatarPreview(null) }}
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: editing ? 'var(--color-error-light)' : 'var(--color-bg-soft)', color: editing ? 'var(--color-error)' : 'var(--color-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
            {editing ? '✕ Cancelar' : '✏️ Editar'}
          </button>
        )}
      </div>

      <div style={{ padding: '20px', flex: 1 }}>

        {/* AVATAR + NOM */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '0.5px solid var(--color-border)' }}>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 700, color: 'var(--color-primary)', overflow: 'hidden', border: '3px solid var(--color-bg-soft)' }}>
              {avatarDisplay ? <img src={avatarDisplay} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : channel.name[0].toUpperCase()}
            </div>
            {editing && (
              <>
                <button onClick={() => avatarInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📷
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
              </>
            )}
          </div>

          {editing ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre del canal" maxLength={30} style={{ ...inputSt, textAlign: 'center', fontWeight: 700, fontSize: '16px' }} />
              <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={2} maxLength={200} placeholder="Descripción del canal..."
                style={{ ...inputSt, resize: 'none', textAlign: 'center' }} />
              {avatarError && <div style={{ fontSize: '12px', color: 'var(--color-error)', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>{avatarError}</div>}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving || !editForm.name.trim()}
                style={{ background: editForm.name.trim() ? 'var(--color-primary)' : 'var(--color-bg-soft)', color: editForm.name.trim() ? '#010906' : 'var(--color-text-muted)', border: 'none', padding: '10px', borderRadius: 'var(--radius-md)', cursor: editForm.name.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                {saving ? 'Guardando...' : '✓ Guardar cambios'}
              </motion.button>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>{channel.name}</div>
              {channel.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{channel.description}</div>}
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                {channel.is_private ? '🔒 Canal privado' : '🌐 Canal público'}
              </div>
            </>
          )}
        </div>

        {/* ESTADÍSTICAS */}
        {stats.total > 0 && (
          <InfoSection title="📊 Estadísticas">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Yield', value: `${stats.yieldVal >= 0 ? '+' : ''}${stats.yieldVal.toFixed(1)}%`, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' },
                { label: 'W / L', value: `${stats.won} / ${stats.lost}`, color: 'var(--color-text)' },
                { label: 'Total picks', value: stats.total, color: 'var(--color-text)' },
                { label: 'Cuota media', value: stats.avgOdds, color: 'var(--color-warning)' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowEstadisticas(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}>
              📊 Extraer tabla estadística
            </button>
          </InfoSection>
        )}

        <AnimatePresence>
          {showEstadisticas && (
            <EstadisticasModal
              messages={messages}
              liveStatuses={liveStatuses}
              ownerUsername={ownerProfile?.username || 'tipster'}
              channelName={channel.name}
              onClose={() => setShowEstadisticas(false)}
            />
          )}
        </AnimatePresence>

        {/* CONFIGURACIÓ — only owner */}
        {isOwner && (
          <InfoSection title="⚙️ Configuración">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--color-border)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{channel.is_private ? '🔒 Canal privado' : '🌐 Canal público'}</div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', fontWeight: 600 }}>Acción irreversible</span>
            </div>
            <InfoToggle label="Enlace visible públicamente" desc="Cualquiera puede compartir y ver el link" active={!!channel.link_public} onChange={() => handleToggle('link_public')} />
            {!channel.is_private && (
              <InfoToggle label="Reenviar mensajes" desc="Los miembros pueden reenviar mensajes de este canal" active={channel.allow_forward !== false} onChange={() => handleToggle('allow_forward')} />
            )}

            {/* Deporte e idioma — permiten que el canal aparezca en filtros de búsqueda */}
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Deporte principal</div>
                <select value={channel.sport || ''} onChange={e => handleField('sport', e.target.value)}
                  style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: channel.sport ? 'var(--color-text)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', cursor: 'pointer' }}>
                  <option value=''>Sin especificar</option>
                  {['Fútbol','Baloncesto','Tenis','eSports','MMA','Béisbol','Fútbol Americano','Otros'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Idioma del canal</div>
                <select value={channel.language || ''} onChange={e => handleField('language', e.target.value)}
                  style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: channel.language ? 'var(--color-text)' : 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', cursor: 'pointer' }}>
                  <option value=''>Sin especificar</option>
                  {['Español','Català','English','Português','Français','Deutsch'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Código de invitación</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <div style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  fyourbet.com/canal/{channel.invite_code}
                </div>
                <button onClick={handleCopyLink}
                  style={{ padding: '8px 12px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: copiedLink ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: copiedLink ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                  {copiedLink ? '✓' : '📋'}
                </button>
              </div>
              <button onClick={handleRegenerateCode} disabled={regenerating}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', padding: 0 }}>
                🔄 {regenerating ? 'Generando...' : 'Regenerar código (invalida el anterior)'}
              </button>
            </div>
          </InfoSection>
        )}

        {/* MEMBRES */}
        <InfoSection title={`👥 Miembros (${members.length + 1})`}>
          {loadingMembers ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Cargando...</div>
          ) : (isOwner || isAdmin) ? (
            <>
              <input
                type="text"
                placeholder="Buscar por @usuario..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '7px 10px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(!memberSearch || (ownerProfile?.username || '').toLowerCase().includes(memberSearch.toLowerCase())) && (
                  <MemberRow profile={ownerProfile} userId={channel.owner_id} isChannelOwner canKick={false} canPromote={false} canDemote={false} canBan={false} onViewProfile={setProfileOverlay} />
                )}
                {members
                  .filter(m => !memberSearch || (m.profile?.username || '').toLowerCase().includes(memberSearch.toLowerCase()))
                  .map(m => (
                    <MemberRow
                      key={m.user_id}
                      profile={m.profile}
                      userId={m.user_id}
                      isChannelOwner={false}
                      isMemberAdmin={m.role === 'admin'}
                      canKick={isOwner || (isAdmin && m.role !== 'admin')}
                      onKick={() => handleKick(m.user_id)}
                      canPromote={isOwner && m.role !== 'admin'}
                      onPromote={() => handlePromote(m.user_id)}
                      canDemote={isOwner && m.role === 'admin'}
                      onDemote={() => handleDemote(m.user_id)}
                      canBan={isOwner}
                      onBanClick={setBanModal}
                      onViewProfile={setProfileOverlay}
                    />
                  ))}
                {memberSearch && members.filter(m => (m.profile?.username || '').toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0', textAlign: 'center' }}>Sin resultados</div>
                )}
              </div>
            </>
          ) : (
            /* Vista llegida per a membres normals: creador + admins */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { profile: ownerProfile, userId: channel.owner_id, badge: '👑 Creador' },
                ...members.filter(m => m.role === 'admin').map(m => ({ profile: m.profile, userId: m.user_id, badge: '🛡 Admin' })),
              ].map(({ profile, userId, badge }) => {
                const initial = (profile?.username || userId?.slice(0, 2) || '?')[0].toUpperCase()
                return (
                  <div key={userId} onClick={() => setProfileOverlay(userId)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                      {initial}
                      {profile?.avatar_url && (
                        <img src={profile.avatar_url} alt="" onError={e => { e.currentTarget.style.display = 'none' }}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                        <Username username={profile?.username || '—'} isVerified={profile?.is_verified} size="sm" />
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-full)', padding: '2px 8px', flexShrink: 0 }}>
                      {badge}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </InfoSection>

        {/* MODAL DE VET */}
        {banModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setBanModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '100%', maxWidth: '300px' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>⛔ Vetar a {banModal.username}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Selecciona la duración del veto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  [60 * 60 * 1000,          '1 hora'],
                  [6 * 60 * 60 * 1000,      '6 horas'],
                  [24 * 60 * 60 * 1000,     '24 horas'],
                  [7 * 24 * 60 * 60 * 1000, '7 días'],
                  [30 * 24 * 60 * 60 * 1000,'30 días'],
                ].map(([ms, label]) => (
                  <button key={ms} onClick={() => handleBan(banModal.userId, new Date(Date.now() + ms).toISOString())}
                    style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                    ⏱ {label}
                  </button>
                ))}
                <button onClick={() => handleBan(banModal.userId, null)}
                  style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                  🚫 Permanente
                </button>
                <button onClick={() => setBanModal(null)}
                  style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ENLACE per a membres normals */}
        {!isOwner && channel.link_public && (
          <InfoSection title="Enlace de invitación">
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                fyourbet.com/canal/{channel.invite_code}
              </div>
              <button onClick={handleCopyLink}
                style={{ padding: '8px 12px', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: copiedLink ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', color: copiedLink ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                {copiedLink ? '✓' : '📋'}
              </button>
            </div>
          </InfoSection>
        )}

        {/* FOTOS */}
        {images.length > 0 && (
          <InfoSection title={`📷 Fotos (${images.length})`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {images.map(m => (
                <a key={m.id} href={m.content.replace('[IMAGE]:', '')} target="_blank" rel="noreferrer">
                  <img src={m.content.replace('[IMAGE]:', '')} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block' }} />
                </a>
              ))}
            </div>
          </InfoSection>
        )}

        {/* LINKS */}
        {links.length > 0 && (
          <InfoSection title={`🔗 Enlaces (${links.length})`}>
            {links.map(m => (
              <a key={m.id} href={m.content} target="_blank" rel="noreferrer"
                style={{ display: 'block', fontSize: '12px', color: 'var(--color-primary)', padding: '8px 12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                🔗 {m.content}
              </a>
            ))}
          </InfoSection>
        )}

        {/* PAGAMENT */}
        {isOwner && (
          <InfoSection title="💳 Ofertas de pago">
            <OfferManager channelId={channel.id} userId={currentUser.id} />
          </InfoSection>
        )}

        {/* ZONA DE PERILL */}
        {isOwner && (
          <InfoSection title="⚠️ Zona de peligro">
            {!showDeleteConfirm ? (
              <button onClick={() => { setShowDeleteConfirm(true); setDeleteInput('') }}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                🗑 Eliminar canal
              </button>
            ) : (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-error)', fontWeight: 700 }}>
                  ⚠️ Esta acción es irreversible
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-error)', lineHeight: 1.5 }}>
                  Se eliminarán permanentemente todos los mensajes, picks e historial del canal. No se puede deshacer.
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Escribe <strong style={{ color: 'var(--color-error)', letterSpacing: '0.5px' }}>ELIMINAR</strong> para confirmar:
                </div>
                <input
                  autoFocus
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="ELIMINAR"
                  style={{ width: '100%', background: 'var(--color-bg)', border: `1.5px solid ${deleteInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-error-border)'}`, color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '9px 12px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', letterSpacing: '1px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                    style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => onDeleteChannel?.(channel.id)}
                    disabled={deleteInput !== 'ELIMINAR'}
                    style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteInput === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteInput === 'ELIMINAR' ? '#fff' : 'var(--color-text-muted)', cursor: deleteInput === 'ELIMINAR' ? 'pointer' : 'default', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                    Eliminar canal
                  </button>
                </div>
              </div>
            )}
          </InfoSection>
        )}

        {/* ZONA ADMIN (només per a admins que NO siguin owners) */}
        {adminMode && !isOwner && (
          <InfoSection title="🛡️ Acciones admin">
            <button onClick={() => { setAdminDeleteOpen(true); setAdminDeleteReason('') }}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              🗑 Eliminar canal (admin)
            </button>
          </InfoSection>
        )}
      </div>

      {/* Modal admin delete amb motiu */}
      <AnimatePresence>
        {adminDeleteOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAdminDeleteOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-xl)', padding: '24px', maxWidth: '460px', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px', color: 'var(--color-error)' }}>🛡️ Eliminar canal como admin</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                Canal: <strong style={{ color: 'var(--color-text)' }}>{channel.name}</strong>
              </div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Motivo (visible al propietario)</label>
              <textarea value={adminDeleteReason} onChange={e => setAdminDeleteReason(e.target.value)} rows={4}
                placeholder="Explica por qué se elimina este canal..."
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setAdminDeleteOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleAdminDeleteChannel} disabled={adminDeleting || !adminDeleteReason.trim()}
                  style={{ padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: adminDeleting || !adminDeleteReason.trim() ? 0.5 : 1 }}>
                  {adminDeleting ? 'Eliminando...' : 'Eliminar canal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY PERFIL membre */}
      <AnimatePresence>
        {profileOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setProfileOverlay(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', padding: '20px', boxSizing: 'border-box' }}>
              <ProfileView
                userId={profileOverlay}
                currentUser={currentUser}
                onBack={() => setProfileOverlay(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function ChatView({ channel: initialChannel, user, onBack, memberCount, onLeave, onDeleteChannel, onOpenCanal, onAddBet, onChannelUpdated }) {
  const { adminMode } = useAdminMode()
  const { messages, loading, sendMessage, recordView, deleteMessage } = useMessages(initialChannel.id, user?.id)
  const [channel, setChannel] = useState(initialChannel)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [muted, setMuted] = useState(false)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(0)
  const wasAtBottomRef = useRef(true)
  const observerRef = useRef(null)
  const isOwner = channel.owner_id === user.id
  const isDeleted = !!channel.deleted_at
  const [isAdmin, setIsAdmin] = useState(false)
  const [liveBetStatuses, setLiveBetStatuses] = useState({})
  const [liveBetReviewStatuses, setLiveBetReviewStatuses] = useState({})
  const [deletedMessageIds, setDeletedMessageIds] = useState(new Set())
  const [profileModal, setProfileModal] = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [pastedImage, setPastedImage] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [msgMenu, setMsgMenu] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [editedMap, setEditedMap] = useState({})
  const [pinnedMsg, setPinnedMsg] = useState(() => parsePinnedValue(channel.pinned_message))
  const [pinDurationFor, setPinDurationFor] = useState(null)
  const [highlightedMsgId, setHighlightedMsgId] = useState(null)
  const [postModalMessageId, setPostModalMessageId] = useState(null)
  const [showPollCreator, setShowPollCreator] = useState(false)

  // Sincronitza pinned_message des de la BD en obrir el canal (per si el channel prop arriba sense el camp)
  useEffect(() => {
    supabase.from('channels').select('pinned_message').eq('id', channel.id).single()
      .then(({ data }) => { if (data) setPinnedMsg(parsePinnedValue(data.pinned_message)) })
  }, [channel.id])

  // Memoitza els IDs d'apostes — només re-comprova si canvia algun ID, no a cada poll
  const betIdsKey = messages
    .filter(m => isBetMessage(m.content))
    .map(m => parseBetMessage(m.content)?.id)
    .filter(Boolean)
    .sort()
    .join(',')

  useEffect(() => {
    if (!betIdsKey) { setLiveBetStatuses({}); return }
    const betIds = betIdsKey.split(',')
    // Obté status i review_status per actualitzar estadístiques en temps real
    supabase.from('bets').select('id, status, review_status').in('id', betIds)
      .then(({ data }) => {
        if (!data) return
        setLiveBetStatuses(Object.fromEntries(data.map(b => [b.id, b.status])))
        setLiveBetReviewStatuses(Object.fromEntries(data.map(b => [b.id, b.review_status ?? null])))
      })
  }, [betIdsKey])

  const channelStats = calcChannelStats(messages, liveBetStatuses, liveBetReviewStatuses)

  useEffect(() => {
    if (!user?.id || isOwner || user.id === 'dev-skip') return
    supabase.from('channel_members').select('role')
      .eq('channel_id', channel.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'))
  }, [channel.id, user.id, isOwner])

  const isNearBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const newCount = messages.length
    const prevCount = prevCountRef.current
    if (newCount > prevCount && (wasAtBottomRef.current || prevCount === 0)) {
      bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' })
    }
    prevCountRef.current = newCount
  }, [messages])

  // IntersectionObserver: registra vista quan el missatge apareix a pantalla
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.dataset.msgid
          if (msgId) recordView(msgId)
        }
      })
    }, { root: container, threshold: 0.1 })
    container.querySelectorAll('[data-msgid]').forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [messages, recordView])

  const removeFromView = (msgId) => setDeletedMessageIds(prev => { const n = new Set(prev); n.add(msgId); return n })

  const handleDelete = async (msgId) => {
    await deleteMessage(msgId)
    setMsgMenu(null)
  }

  const handlePin = async (rawContent, durationMs) => {
    if (pinnedMsg?.rawContent === rawContent) {
      await supabase.from('channels').update({ pinned_message: null }).eq('id', channel.id)
      setPinnedMsg(null)
      setMsgMenu(null)
      return
    }
    const e = durationMs ? Date.now() + durationMs : null
    const val = JSON.stringify({ c: rawContent, e })
    await supabase.from('channels').update({ pinned_message: val }).eq('id', channel.id)
    setPinnedMsg({ rawContent, expiresAt: e })
    onChannelUpdated?.({ ...channel, pinned_message: val })
    setPinDurationFor(null)
  }

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedMsgId(msgId)
    setTimeout(() => setHighlightedMsgId(null), 2200)
  }

  const handleSend = async () => {
    if (!text.trim() && !pastedImage) return
    if (editingMsg) {
      const saved = text + '[EDITED]'
      await supabase.from('channel_messages').update({ content: saved }).eq('id', editingMsg.id)
      setEditedMap(prev => ({ ...prev, [editingMsg.id]: saved }))
      setEditingMsg(null)
      setText('')
      return
    }

    let imageUrl = null
    if (pastedImage) {
      setUploading(true)
      setUploadError('')
      try {
        imageUrl = await uploadToStorage(pastedImage.file)
      } catch (err) {
        setUploadError(`Error al subir: ${err.message || 'Error inesperado.'}`)
        setUploading(false)
        return
      } finally {
        URL.revokeObjectURL(pastedImage.previewUrl)
        setPastedImage(null)
      }
      setUploading(false)
    }

    const trimmedText = text.trim()
    let content
    if (imageUrl && trimmedText) {
      content = `[IMG_MSG]:${JSON.stringify({ url: imageUrl, text: trimmedText })}`
    } else if (imageUrl) {
      content = `[IMAGE]:${imageUrl}`
    } else {
      content = trimmedText
    }

    if (replyTo) content = `[REPLY:${replyTo.id}|${replyTo.preview}]:${content}`
    setText('')
    setReplyTo(null)
    await sendMessage(content, user.id)
    notifyChannelMembers(content)
  }

  const notifyChannelMembers = async (content) => {
    const { data: members } = await supabase
      .from('channel_members').select('user_id').eq('channel_id', initialChannel.id)
    const recipientIds = [
      ...(members || []).map(m => m.user_id),
      initialChannel.owner_id,
    ].filter((id, i, arr) => id !== user.id && arr.indexOf(id) === i)
    const stripped = content.replace(/^\[FWD[^\]]*\]:/, '').replace(/^\[REPLY:[^\]]*\]:/, '')
    let preview
    if (stripped.startsWith('[IMG_MSG]:')) {
      try { preview = '📷 ' + (JSON.parse(stripped.replace('[IMG_MSG]:', '')).text || 'Imagen') } catch { preview = '📷 Imagen' }
    } else {
      preview = stripped.slice(0, 80)
    }
    await Promise.all(recipientIds.map(uid =>
      insertNotification({
        userId: uid,
        type: 'channel_message',
        fromUserId: user.id,
        fromUsername: user.username || user.email,
        preview: `[${initialChannel.name}] ${preview}`,
      })
    ))
  }

  const handleSendSticker = (sticker) => {
    setText(prev => prev + sticker)
  }

  const handleSendGif = async (url) => {
    await sendMessage(`[GIF]:${url}`, user.id)
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') { setReplyTo(null); setEditingMsg(null); setText(''); return }
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (e.ctrlKey) { setText(prev => prev + '\n') } else { handleSend() }
  }

  const uploadToStorage = async (file) => {
    const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
    const path = `${channel.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('channel-files').upload(path, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
    return urlData.publicUrl
  }

  const uploadFile = async (file) => {
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadToStorage(file)
      const isImg = /^image\/(jpeg|png|gif|webp)$/.test(file.type) || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name || '')
      const content = isImg ? `[IMAGE]:${url}` : `[FILE:${file.name}]:${url}`
      await sendMessage(content, user.id)
    } catch (err) {
      setUploadError(`Error al subir: ${err.message || 'Error inesperado.'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  const handleInternalLink = (code) => { onOpenCanal?.(code) }

  const menuItems = [
    { icon: 'ℹ️', label: 'Info del canal', action: () => { setShowInfo(true); setShowMenu(false) } },
    { icon: muted ? '🔔' : '🔕', label: muted ? 'Activar notificaciones' : 'Silenciar', action: () => { setMuted(!muted); setShowMenu(false) } },
    { icon: '🚩', label: 'Reportar canal', action: () => { alert('Canal reportado. Lo revisaremos pronto.'); setShowMenu(false) } },
    ...(!isOwner ? [{ icon: '🚪', label: 'Abandonar canal', action: () => { onLeave?.(); setShowMenu(false) }, danger: true }] : []),
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', position: 'relative' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)' }}>←</button>
        <div onClick={() => setShowInfo(true)} style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg-soft)', cursor: 'pointer' }}>
          {channel.avatar_url ? <img src={channel.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : channel.name[0].toUpperCase()}
        </div>
        <div onClick={() => setShowInfo(true)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ fontWeight: 700, fontSize: '18px' }}>{channel.name}</div>
          {channel.description && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{channel.description}</div>}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>👥 {memberCount} participantes</span>
        {isOwner && <span style={{ fontSize: '11px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid var(--color-primary-border)', fontWeight: 600 }}>Tu canal</span>}
        {!isOwner && isAdmin && <span style={{ fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)', padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '0.5px solid rgba(245,158,11,0.3)', fontWeight: 600 }}>Admin</span>}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(!showMenu)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}>
            ⋮
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  style={{ position: 'absolute', top: '36px', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '200px', overflow: 'hidden' }}>
                  {menuItems.map((item, i) => (
                    <button key={i} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: item.danger ? 'var(--color-error)' : 'var(--color-text)', textAlign: 'left', borderBottom: i < menuItems.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isDeleted && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</div>
          <div style={{ flex: 1, minWidth: '180px', fontSize: '13px', color: 'var(--color-error)', lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>
              {channel.deletion_reason ? 'Este canal ha sido eliminado por moderación.' : 'Este canal ha sido eliminado por el administrador.'}
            </div>
            {channel.deletion_reason && (
              <div style={{ fontWeight: 500, fontSize: '12px', opacity: 0.85 }}>Motivo: {channel.deletion_reason}</div>
            )}
            <div style={{ fontSize: '12px', opacity: 0.75, marginTop: '2px' }}>Desaparecerá automáticamente de tu lista en 3 días.</div>
          </div>
          {!isOwner && (
            <button onClick={() => onLeave?.()}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
              Salir
            </button>
          )}
        </motion.div>
      )}

      {/* Missatge fixat */}
      {pinnedMsg && !isDeleted && (() => {
        const { inner: pNoFwd } = parseForward(pinnedMsg.rawContent)
        const { inner: pNoReply } = parseReply(pNoFwd)
        const { content: pDisplay } = parseEdited(pNoReply)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>📌</span>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>{pDisplay}</div>
            {(isOwner || isAdmin) && (
              <button onClick={() => handlePin(pinnedMsg.rawContent, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-muted)', flexShrink: 0, padding: '0 4px' }}>✕</button>
            )}
          </div>
        )
      })()}

      <div ref={scrollRef} onScroll={() => { wasAtBottomRef.current = isNearBottom() }}
        style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Sin mensajes todavía.</div>
          </div>
        ) : messages.filter(m => !deletedMessageIds.has(m.id) && m.content !== '[DELETED]').map((m, i) => {
          const isOwn = m.user_id === user.id
          const rawContent = editedMap[m.id] ?? m.content
          const isDeletedMsg = rawContent === '[DELETED]'
          const { forwardedFrom, inner: noFwd } = parseForward(rawContent)
          const { replyId, replyPreview, inner: noReply } = parseReply(noFwd)
          const { edited, content: displayContent } = parseEdited(noReply)
          const isBet = isBetMessage(displayContent)
          const isPoll = isPollMessage(displayContent)
          const isImage = isImageMessage(displayContent)
          const isSticker = isStickerMessage(displayContent)
          const isProfile = isProfileMessage(displayContent)
          const isVoice = isVoiceMessage(displayContent)
          const isNobubble = isSticker || isBet || isProfile || isPoll
          const timeStr = formatMsgTime(m.created_at)
          const prev = messages[i - 1]
          const showDaySep = !prev || getDayLabel(m.created_at) !== getDayLabel(prev.created_at)
          const isHovered = hoveredMsgId === m.id
          const isMenuOpen = msgMenu?.id === m.id
          const isHighlighted = highlightedMsgId === m.id
          return (
            <div key={m.id} id={`msg-${m.id}`} data-msgid={m.id}
              onMouseEnter={() => setHoveredMsgId(m.id)}
              onMouseLeave={() => { if (!isMenuOpen) setHoveredMsgId(null) }}
              style={{ borderRadius: 'var(--radius-md)', padding: '1px 2px', margin: '-1px -2px', transition: 'background 0.4s', background: isHighlighted ? 'rgba(15,110,86,0.13)' : 'transparent' }}>
              {showDaySep && <DaySeparator label={getDayLabel(m.created_at) ?? ''} />}

              {isDeletedMsg ? (
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', margin: '2px 0' }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '7px 12px' }}>
                    🚫 Mensaje eliminado
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '2px' }}>
                  {/* ⋮ a l'esquerra dels missatges propis */}
                  {isOwn && (
                    <button
                      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                      style={{ opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: 1, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                      ⋮
                    </button>
                  )}
                  <div style={{ maxWidth: isBet || isProfile ? '320px' : isNobubble ? 'fit-content' : isVoice ? '280px' : '70%' }}>
                    {forwardedFrom && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>↩</span>
                        <span>{forwardedFrom === 'dm' ? 'Reenviado' : `Reenviado de ${forwardedFrom}`}</span>
                      </div>
                    )}
                    <div style={{
                        position: 'relative',
                        background: isNobubble ? 'transparent' : isOwn ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                        color: isOwn ? '#010906' : 'var(--color-text)',
                        padding: isNobubble ? '0' : isImage ? '6px' : isVoice ? '10px 12px 22px 12px' : '7px 12px 19px 12px',
                        borderRadius: isNobubble || isImage ? 'var(--radius-lg)' : isOwn ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                        minWidth: !isNobubble && !isImage && !isVoice ? '63px' : undefined,
                        fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', textAlign: 'left',
                        border: isOwn || isNobubble ? 'none' : '0.5px solid var(--color-border)',
                      }}>
                      {replyPreview && (
                        <div onClick={() => replyId && scrollToMessage(replyId)}
                          style={{ background: isOwn ? 'rgba(1,9,6,0.12)' : 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isOwn ? 'rgba(1,9,6,0.35)' : 'var(--color-primary)'}`, borderRadius: '4px', padding: '5px 8px', marginBottom: '8px', fontSize: '12px', opacity: 0.85, overflow: 'hidden', maxHeight: '52px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: replyId ? 'pointer' : 'default' }}>
                          {replyPreview}
                        </div>
                      )}
                      {isBet
                        ? <ChannelBetPost
                            messageId={m.id}
                            bet={parseBetMessage(displayContent)}
                            liveStatus={liveBetStatuses[parseBetMessage(displayContent)?.id]}
                            liveReviewStatus={liveBetReviewStatuses[parseBetMessage(displayContent)?.id]}
                            currentUser={user}
                            isOwner={isOwn}
                            onOpenPost={() => setPostModalMessageId(m.id)}
                            timeStr={timeStr}
                            viewCount={m.view_count || 0}
                          />
                        : isPoll
                        ? <PollCard
                            messageId={m.id}
                            poll={parsePollMessage(displayContent)}
                            currentUser={user}
                            timeStr={timeStr}
                            viewCount={m.view_count || 0}
                            isCreator={isOwn}
                            onFinalize={async () => {
                              const pollData = parsePollMessage(displayContent)
                              const newContent = `[POLL]:${JSON.stringify({ ...pollData, closed: true })}`
                              await supabase.from('channel_messages').update({ content: newContent }).eq('id', m.id)
                              setEditedMap(prev => ({ ...prev, [m.id]: newContent }))
                            }}
                          />
                        : isImage
                        ? (
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                              <ImageMessage url={displayContent.replace('[IMAGE]:', '')} />
                              <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.45)', color: '#fff', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 500, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                                {m.view_count > 0 ? `👁 ${m.view_count} · ` : ''}{timeStr}
                              </span>
                            </div>
                          )
                        : renderMessage(displayContent, handleInternalLink, isOwn, setProfileModal, timeStr, m.view_count || 0)}
                      {edited && !isNobubble && !isImage && (
                        <span style={{ fontSize: '10px', opacity: 0.55, fontStyle: 'italic', marginLeft: '4px' }}>(editado)</span>
                      )}
                      {!isNobubble && !isImage && (
                        <span style={{ position: 'absolute', bottom: '5px', right: '10px', fontSize: '10px', fontWeight: 500, color: isOwn ? 'rgba(1,9,6,0.65)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {m.view_count > 0 ? `👁 ${m.view_count} · ` : ''}{timeStr}
                        </span>
                      )}
                    </div>
                    {isSticker && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px', textAlign: isOwn ? 'right' : 'left' }}>
                        {timeStr}
                      </div>
                    )}
                  </div>
                  {/* ⋮ a la dreta dels missatges dels altres */}
                  {!isOwn && (
                    <button
                      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMsgMenu(isMenuOpen ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                      style={{ opacity: isHovered || isMenuOpen ? 1 : 0, pointerEvents: isHovered || isMenuOpen ? 'auto' : 'none', transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text-muted)', padding: '0 2px', lineHeight: 1, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                      ⋮
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {isDeleted ? (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }}>
          Este canal está eliminado. No se pueden enviar mensajes.
        </div>
      ) : (isOwner || isAdmin) ? (
        <div style={{ marginTop: '12px' }}>
          {uploadError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-error)' }}>
              {uploadError}
            </div>
          )}
          {/* Banner resposta / edició */}
          {(replyTo || editingMsg) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${editingMsg ? 'var(--color-warning)' : 'var(--color-primary)'}`, paddingLeft: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: editingMsg ? 'var(--color-warning)' : 'var(--color-primary)', marginBottom: '1px' }}>{editingMsg ? '✏️ Editando' : '↩ Respondiendo'}</div>
                {replyTo && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.preview}</div>}
              </div>
              <button onClick={() => { setReplyTo(null); setEditingMsg(null); setText('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>✕</button>
            </div>
          )}

          {/* Preview imatge enganxada */}
          {pastedImage && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '8px' }}>
              <img src={pastedImage.previewUrl} alt="preview"
                style={{ maxHeight: '120px', maxWidth: '220px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-primary-border)', objectFit: 'cover', display: 'block' }} />
              <button onClick={() => { URL.revokeObjectURL(pastedImage.previewUrl); setPastedImage(null) }}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} onChange={handleFile} accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display: 'none' }} />

            {/* Botó + per accions secundàries */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => { setShowMenu(false); setShowStickers(false); setShowExtras(v => !v) }}
                style={{ background: showExtras ? 'var(--color-primary-light)' : 'var(--color-bg)', border: `0.5px solid ${showExtras ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '18px', color: showExtras ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0, lineHeight: 1 }}>
                +
              </button>
              <AnimatePresence>
                {showExtras && (
                  <>
                    <div onClick={() => setShowExtras(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      style={{ position: 'absolute', bottom: '48px', left: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '180px', overflow: 'hidden' }}>
                      <button onClick={() => { fileInputRef.current?.click(); setShowExtras(false) }} disabled={uploading}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                        <span>{uploading ? '⏳' : '📎'}</span><span>Adjuntar archivo</span>
                      </button>
                      <button onClick={() => { onAddBet?.(channel.id); setShowExtras(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: (isOwner || isAdmin) ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-primary)', fontWeight: 700, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                        <span>📊</span><span>Añadir apuesta</span>
                      </button>
                      {(isOwner || isAdmin) && (
                        <button onClick={() => { setShowPollCreator(true); setShowExtras(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                          <span>🗳️</span><span>Crear encuesta</span>
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <VoiceRecordButton userId={user.id} onSend={async content => { await sendMessage(content, user.id) }} />

            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
              placeholder="Envía un mensaje" rows={2}
              onPaste={e => {
                const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
                if (item) {
                  e.preventDefault()
                  const file = item.getAsFile()
                  if (file) setPastedImage({ file, previewUrl: URL.createObjectURL(file) })
                }
              }}
              style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowStickers(v => !v)}
                style={{ background: showStickers ? 'var(--color-primary-light)' : 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: showStickers ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                😊
              </button>
              <AnimatePresence>
                {showStickers && <StickerPicker onSelect={handleSendSticker} onSendGif={handleSendGif} onClose={() => setShowStickers(false)} user={user} />}
              </AnimatePresence>
            </div>

            <Button onClick={handleSend} disabled={!text.trim() && !pastedImage}>Enviar</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }}>
          Solo el propietario y los administradores pueden enviar mensajes
        </div>
      )}

      <AnimatePresence>
        {showInfo && (
          <InfoView channel={channel} messages={messages} liveStatuses={liveBetStatuses} isOwner={isOwner} isAdmin={isAdmin}
            onClose={() => setShowInfo(false)}
            onUpdateChannel={(updated) => { setChannel(updated); onChannelUpdated?.(updated) }}
            onDeleteChannel={onDeleteChannel} currentUser={user} />
        )}
      </AnimatePresence>

      {/* Menú contextual missatge */}
      <AnimatePresence>
        {msgMenu && (() => {
          const msg = messages.find(m => m.id === msgMenu.id)
          if (!msg) return null
          const rawContent = editedMap[msg.id] ?? msg.content
          const { forwardedFrom, inner: noFwd } = parseForward(rawContent)
          const { inner: noReply } = parseReply(noFwd)
          const { content: displayContent } = parseEdited(noReply)
          const isOwnMsg = msg.user_id === user.id
          const isBetMsg = isBetMessage(displayContent)
          const isImgMsg = isImageMessage(displayContent)
          const isImgTextMsg = isImgTextMessage(displayContent)
          const isStkMsg = isStickerMessage(displayContent)
          const isVoiceMsg = isVoiceMessage(displayContent)
          const isProfMsg = isProfileMessage(displayContent)
          const isPollMsg = isPollMessage(displayContent)
          const canFwd = channel.is_private ? isOwner : channel.allow_forward !== false
          const canEdit = isOwnMsg && !forwardedFrom && !isBetMsg && !isImgMsg && !isImgTextMsg && !isStkMsg && !isVoiceMsg && !isProfMsg && !isPollMsg
          const canDel = isOwnMsg || isOwner || isAdmin || adminMode
          const canPin = isOwner || isAdmin || adminMode
          const readable = readableContent(displayContent)

          const items = [
            { icon: '📋', label: 'Copiar', action: () => { navigator.clipboard.writeText(readable); setMsgMenu(null) } },
            { icon: '↩', label: 'Responder', action: () => { setReplyTo({ id: msg.id, preview: readable.slice(0, 80) }); setMsgMenu(null) } },
            canFwd && { icon: '↗️', label: 'Reenviar', action: () => { setForwardMsg({ content: displayContent, fromChannelName: channel.name }); setMsgMenu(null) } },
            canPin && { icon: '📌', label: pinnedMsg?.rawContent === rawContent ? 'Desfijar' : 'Fijar', action: () => { if (pinnedMsg?.rawContent === rawContent) { handlePin(rawContent, null) } else { setPinDurationFor(rawContent); setMsgMenu(null) } } },
            canEdit && { icon: '✏️', label: 'Editar', action: () => { setEditingMsg({ id: msg.id }); setText(displayContent); setMsgMenu(null) } },
            canDel && !isBetMsg && { icon: '🗑', label: 'Eliminar', action: () => handleDelete(msg.id), danger: true },
          ].filter(Boolean)

          const menuH = items.length * 44
          const showAbove = msgMenu.y + menuH > window.innerHeight - 20
          const posStyle = showAbove
            ? { bottom: window.innerHeight - msgMenu.y + 4 }
            : { top: msgMenu.y + 4 }
          const leftPos = Math.min(msgMenu.x, window.innerWidth - 190)

          return (
            <>
              <div onClick={() => setMsgMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
              <motion.div key="ctxmenu"
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.93 }}
                style={{ position: 'fixed', left: leftPos, ...posStyle, zIndex: 150, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: '175px' }}>
                {items.map((item, idx) => (
                  <button key={idx} onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: idx < items.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: item.danger ? 'var(--color-error)' : 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>

      {/* Forward modal */}
      <AnimatePresence>
        {forwardMsg && (
          <ForwardModal
            content={forwardMsg.content}
            fromChannelName={forwardMsg.fromChannelName}
            currentUser={user}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Pin duration modal */}
      <AnimatePresence>
        {pinDurationFor && (
          <PinDurationModal
            onSelect={(ms) => handlePin(pinDurationFor, ms)}
            onClose={() => setPinDurationFor(null)}
          />
        )}
      </AnimatePresence>

      {/* Overlay perfil des de targeta [PROFILE]: */}
      <AnimatePresence>
        {profileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setProfileModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', padding: '20px', boxSizing: 'border-box' }}>
              <ProfileView userId={profileModal} currentUser={user} onBack={() => setProfileModal(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PostModal per picks del canal */}
      <AnimatePresence>
        {postModalMessageId && (
          <PostModal messageId={postModalMessageId} currentUser={user} onClose={() => setPostModalMessageId(null)} />
        )}
      </AnimatePresence>

      {/* Modal creació d'enquesta */}
      <AnimatePresence>
        {showPollCreator && (
          <PollCreatorModal
            channelId={channel.id}
            userId={user.id}
            onClose={() => setShowPollCreator(false)}
            onSent={() => {}}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}