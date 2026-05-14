import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { useMessages } from './hooks/useMessages'

function parseBetMessage(content) {
  try {
    return JSON.parse(content.replace('[BET]:', ''))
  } catch { return null }
}

function BetCard({ bet }) {
  const statusColor = bet.status === 'won' ? 'var(--color-primary)' : bet.status === 'lost' ? 'var(--color-error)' : 'var(--color-text-muted)'
  const statusLabel = bet.status === 'won' ? '✓ Ganada' : bet.status === 'lost' ? '✗ Perdida' : '⏳ Pendiente'
  const statusBg = bet.status === 'won' ? 'var(--color-primary-light)' : bet.status === 'lost' ? 'var(--color-error-light)' : 'var(--color-bg-soft)'

  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', minWidth: '240px', maxWidth: '300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>📊 Pick</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: statusBg, color: statusColor, fontWeight: 700, border: `0.5px solid ${statusColor}` }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{bet.event}</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
        {bet.sport} · {bet.market}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Pick', value: bet.pick },
          { label: 'Cuota', value: parseFloat(bet.odds).toFixed(2) },
          { label: 'Stake', value: `S${bet.stake}` },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{s.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
        🕐 {new Date(bet.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

function renderMessage(content, onInternalLink, isOwnerMsg = false) {
  const linkColor = isOwnerMsg ? '#010906' : 'var(--color-primary)'

  if (content.startsWith('[BET]:')) {
    const bet = parseBetMessage(content)
    if (bet) return <BetCard bet={bet} />
    return null
  }
  if (content.startsWith('[IMAGE]:')) {
    const url = content.replace('[IMAGE]:', '')
    return <img src={url} alt="img" style={{ display: 'block', minWidth: '160px', minHeight: '120px', maxWidth: '100%', maxHeight: '340px', borderRadius: 'var(--radius-md)' }} />
  }
  if (content.startsWith('[FILE:')) {
    const match = content.match(/\[FILE:(.*?)\]:(.*)/)
    if (match) return (
      <a href={match[2]} target="_blank" rel="noreferrer" style={{ color: linkColor, display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <span>📎</span><span style={{ textDecoration: 'underline', fontSize: '13px' }}>{match[1]}</span>
      </a>
    )
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = content.split(urlRegex)
  if (parts.length > 1) {
    return (
      <span>
        {parts.map((part, i) => {
          if (!/^https?:\/\//.test(part)) return part
          const isCanalLink = part.includes('fyourbet.com/canal/')
          if (isCanalLink) {
            const code = part.split('/canal/')[1]?.split(/[?#\s]/)[0]
            return (
              <span key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInternalLink?.(code) }}
                style={{ color: linkColor, textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all', userSelect: 'none' }}>
                📡 {part}
              </span>
            )
          }
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer"
              style={{ color: linkColor, textDecoration: 'underline', wordBreak: 'break-all' }}>
              {part}
            </a>
          )
        })}
      </span>
    )
  }
  return content
}

function isImageMessage(content) { return content.startsWith('[IMAGE]:') }
function isLinkMessage(content) { return content.startsWith('http://') || content.startsWith('https://') }
function isBetMessage(content) { return content.startsWith('[BET]:') }

function formatMsgTime(created_at) {
  if (!created_at) return ''
  const date = new Date(created_at)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function getDayLabel(created_at) {
  if (!created_at) return null
  const date = new Date(created_at)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - msgDay) / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function DaySeparator({ label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)',
        background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-full)', padding: '3px 12px',
      }}>
        {label}
      </span>
    </div>
  )
}

function calcChannelStats(messages) {
  const betMessages = messages.filter(m => isBetMessage(m.content))
  const bets = betMessages.map(m => parseBetMessage(m.content)).filter(Boolean)
  const resolved = bets.filter(b => b.status !== 'pending')
  const won = bets.filter(b => b.status === 'won').length
  const lost = bets.filter(b => b.status === 'lost').length
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

function MemberRow({ profile, userId, isChannelOwner, isMemberAdmin, canKick, onKick, canPromote, onPromote, canDemote, onDemote }) {
  const initial = (profile?.username || userId?.slice(0, 2) || '?')[0].toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden' }}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          @{profile?.username || userId?.slice(0, 8) || '?'}
          {isChannelOwner && <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '0.5px solid rgba(245,158,11,0.3)' }}>Creador</span>}
          {isMemberAdmin && !isChannelOwner && <span style={{ fontSize: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '1px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '0.5px solid var(--color-primary-border)' }}>Admin</span>}
        </div>
        {profile?.name && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{profile.name}</div>}
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {canPromote && (
          <button onClick={onPromote}
            style={{ background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}>
            ⬆ Admin
          </button>
        )}
        {canDemote && (
          <button onClick={onDemote}
            style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}>
            ⬇ Miembro
          </button>
        )}
        {canKick && (
          <button onClick={onKick}
            style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}>
            Expulsar
          </button>
        )}
      </div>
    </div>
  )
}

function InfoView({ channel, messages, isOwner, isAdmin, onClose, onUpdateChannel, onDeleteChannel }) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: channel.name, description: channel.description || '' })
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  const stats = calcChannelStats(messages)
  const images = messages.filter(m => isImageMessage(m.content))
  const links = messages.filter(m => isLinkMessage(m.content))

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    const [{ data: mems }, { data: ownerProf }] = await Promise.all([
      supabase.from('channel_members').select('user_id, joined_at, role').eq('channel_id', channel.id).order('joined_at', { ascending: true }),
      supabase.from('profiles').select('id, username, name, avatar_url').eq('id', channel.owner_id).single(),
    ])
    setOwnerProfile(ownerProf)
    if (!mems?.length) { setLoadingMembers(false); return }
    const userIds = mems.map(m => m.user_id).filter(id => id !== channel.owner_id)
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, username, name, avatar_url').in('id', userIds)
      : { data: [] }
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setMembers(mems.filter(m => m.user_id !== channel.owner_id).map(m => ({ ...m, profile: profileMap[m.user_id] || null })))
    setLoadingMembers(false)
  }

  const handleSave = async () => {
    if (!editForm.name.trim()) return
    setSaving(true)
    setAvatarError('')
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
                placeholder="Nombre del canal" style={{ ...inputSt, textAlign: 'center', fontWeight: 700, fontSize: '16px' }} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
          </InfoSection>
        )}

        {/* CONFIGURACIÓ — only owner */}
        {isOwner && (
          <InfoSection title="⚙️ Configuración">
            <InfoToggle label="Canal privado" desc="Solo accesible con código de invitación" active={channel.is_private} onChange={() => handleToggle('is_private')} />
            <InfoToggle label="Enlace visible públicamente" desc="Cualquiera puede compartir y ver el link" active={!!channel.link_public} onChange={() => handleToggle('link_public')} />
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <MemberRow profile={ownerProfile} userId={channel.owner_id} isChannelOwner canKick={false} canPromote={false} canDemote={false} />
              {members.map(m => (
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
                />
              ))}
            </div>
          )}
        </InfoSection>

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

        {/* ZONA DE PERILL */}
        {isOwner && (
          <InfoSection title="⚠️ Zona de peligro">
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                🗑 Eliminar canal
              </button>
            ) : (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-error)', fontWeight: 600, marginBottom: '10px' }}>¿Seguro? Se eliminarán todos los mensajes y picks del canal.</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                  <button onClick={() => onDeleteChannel?.(channel.id)}
                    style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </InfoSection>
        )}
      </div>
    </motion.div>
  )
}

export default function ChatView({ channel: initialChannel, user, onBack, memberCount, onLeave, onDeleteChannel, onOpenCanal, onAddBet, onChannelUpdated }) {
  const { messages, loading, sendMessage } = useMessages(initialChannel.id)
  const [channel, setChannel] = useState(initialChannel)
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [muted, setMuted] = useState(false)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const prevCountRef = useRef(0)
  const wasAtBottomRef = useRef(true)
  const isOwner = channel.owner_id === user.id
  const [isAdmin, setIsAdmin] = useState(false)

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

  const handleSend = async () => {
    if (!text.trim()) return
    const content = text
    setText('')
    await sendMessage(content, user.id)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${channel.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('channel-files').upload(path, file, { upsert: true })
      if (error) { setUploadError(`Error al subir: ${error.message}`); return }
      const { data: urlData } = supabase.storage.from('channel-files').getPublicUrl(path)
      const isImage = /^image\/(jpeg|png|gif|webp)$/.test(file.type) || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
      const content = isImage ? `[IMAGE]:${urlData.publicUrl}` : `[FILE:${file.name}]:${urlData.publicUrl}`
      await sendMessage(content, user.id)
    } catch (err) {
      setUploadError('Error inesperado al subir el archivo.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
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
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, overflow: 'hidden', border: '2px solid var(--color-bg-soft)' }}>
          {channel.avatar_url ? <img src={channel.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : channel.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
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

      <div ref={scrollRef} onScroll={() => { wasAtBottomRef.current = isNearBottom() }}
        style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>⏳ Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <div>Sin mensajes todavía.</div>
          </div>
        ) : messages.map((m, i) => {
          const isBet = isBetMessage(m.content)
          const isOwnerMsg = m.user_id === user.id && !isBet
          const timeStr = formatMsgTime(m.created_at)
          const prev = messages[i - 1]
          const showDaySep = !prev || getDayLabel(m.created_at) !== getDayLabel(prev.created_at)
          return (
            <div key={m.id}>
              {showDaySep && <DaySeparator label={getDayLabel(m.created_at) ?? ''} />}
              <div style={{ display: 'flex', justifyContent: isBet ? 'flex-start' : m.user_id === user.id ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: isBet ? '320px' : '70%' }}>
                  <div style={{
                    position: 'relative',
                    background: isBet ? 'transparent' : m.user_id === user.id ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                    color: isOwnerMsg ? '#010906' : 'var(--color-text)',
                    padding: isBet ? '0' : '10px 14px 22px 14px',
                    borderRadius: 'var(--radius-lg)', fontSize: '14px', lineHeight: 1.5,
                    border: isBet ? 'none' : m.user_id === user.id ? 'none' : '0.5px solid var(--color-border)'
                  }}>
                    {renderMessage(m.content, handleInternalLink, isOwnerMsg)}
                    {!isBet && timeStr && (
                      <span style={{
                        position: 'absolute', bottom: '6px', right: '10px',
                        fontSize: '10px',
                        color: isOwnerMsg ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)',
                        whiteSpace: 'nowrap',
                      }}>
                        {timeStr}
                      </span>
                    )}
                  </div>
                  {isBet && timeStr && (
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px', opacity: 0.6 }}>
                      {timeStr}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {(isOwner || isAdmin) ? (
        <div style={{ marginTop: '12px' }}>
          {uploadError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-error)' }}>
              {uploadError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <input type="file" ref={fileInputRef} onChange={handleFile} accept="image/jpeg,image/png,image/gif,image/webp,.pdf" style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {uploading ? '⏳' : '📎'}
          </button>
          <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
            placeholder="Escribe un mensaje... (Enter para enviar)" rows={2}
            style={{ flex: 1, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => onAddBet?.(channel.id)}
            style={{ background: 'var(--color-primary-light)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
            📊 Añadir apuesta
          </button>
          <Button onClick={handleSend} disabled={!text.trim()}>Enviar</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)' }}>
          Solo el propietario y los administradores pueden enviar mensajes
        </div>
      )}

      <AnimatePresence>
        {showInfo && (
          <InfoView channel={channel} messages={messages} isOwner={isOwner} isAdmin={isAdmin}
            onClose={() => setShowInfo(false)}
            onUpdateChannel={(updated) => { setChannel(updated); onChannelUpdated?.(updated) }}
            onDeleteChannel={onDeleteChannel} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}