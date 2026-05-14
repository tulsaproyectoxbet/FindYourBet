import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'

const DM_OPTIONS = [
  { id: 'followers', icon: '🔒', label: 'Solo seguidores mutuos', desc: 'Solo quien te siga y tú le sigas puede escribirte' },
  { id: 'request', icon: '📨', label: 'Un mensaje', desc: 'Cualquiera puede enviarte 1 mensaje. Tú decides si aceptas' },
  { id: 'everyone', icon: '🌐', label: 'Todos', desc: 'Cualquiera puede escribirte sin restricción' },
]

const inputStyle = {
  width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)',
  color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px',
  padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box'
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 20px', borderRight: '0.5px solid var(--color-border)' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
    </div>
  )
}

function Avatar({ url, name, size = 80, fontSize = 32 }) {
  if (url) return (
    <img src={url} alt="avatar"
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-bg)', display: 'block' }} />
  )
  return (
    <div style={{ width: size, height: size, background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 700, color: '#010906', border: '3px solid var(--color-bg)', flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

export default function MiPerfil({ user, onNavigate }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, won: 0, lost: 0, yieldVal: 0, avgOdds: '—' })
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [recentBets, setRecentBets] = useState([])
  const [dmSetting, setDmSetting] = useState('request')
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [showDmConfig, setShowDmConfig] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingDm, setSavingDm] = useState(false)
  const [activeTab, setActiveTab] = useState('picks')

  // Edit form
  const [editForm, setEditForm] = useState({ name: '', username: '', bio: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: prof },
      { data: bets },
      { count: fersCount },
      { count: fingCount },
      { data: dmSet }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('bets').select('*').eq('user_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('dm_settings').select('allow_dms').eq('user_id', user.id).single(),
    ])

    setProfile(prof)
    setFollowersCount(fersCount || 0)
    setFollowingCount(fingCount || 0)
    if (dmSet) setDmSetting(dmSet.allow_dms)
    if (prof) setEditForm({ name: prof.name || '', username: prof.username || '', bio: prof.bio || '' })

    if (bets && bets.length > 0) {
      const resolved = bets.filter(b => b.status !== 'pending')
      const won = resolved.filter(b => b.status === 'won').length
      const lost = resolved.filter(b => b.status === 'lost').length
      const { profit, stakeSum } = resolved.reduce(
        (acc, b) => ({
          stakeSum: acc.stakeSum + b.stake,
          profit: acc.profit + (b.status === 'won' ? b.stake * (b.odds - 1) : -b.stake)
        }),
        { profit: 0, stakeSum: 0 }
      )
      const yieldVal = stakeSum > 0 ? (profit / stakeSum) * 100 : 0
      const avgOdds = bets.length > 0 ? (bets.reduce((s, b) => s + b.odds, 0) / bets.length).toFixed(2) : '—'
      setStats({ total: resolved.length, won, lost, yieldVal, avgOdds })
      setRecentBets(resolved.slice(0, 6))
    }
    setLoading(false)
  }

  const handleSaveDm = async (val) => {
    setSavingDm(true)
    setDmSetting(val)
    await supabase.from('dm_settings').upsert({ user_id: user.id, allow_dms: val })
    setSavingDm(false)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveError('')

    if (!editForm.name.trim() || !editForm.username.trim()) {
      setSaveError('El nombre y username son obligatorios')
      setSaving(false)
      return
    }

    // Comprova cooldown i unicitat de username (si ha canviat)
    if (editForm.username !== profile?.username) {
      if (profile?.username_changed_at) {
        const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / 86400000
        if (daysSince < 14) {
          const daysLeft = Math.ceil(14 - daysSince)
          setSaveError(`Solo puedes cambiar tu @username cada 14 días. Podrás cambiarlo en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}.`)
          setSaving(false)
          return
        }
      }
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', editForm.username).neq('id', user.id).maybeSingle()
      if (existing) {
        setSaveError('Este @username ya está en uso')
        setSaving(false)
        return
      }
    }

    let avatarUrl = profile?.avatar_url || null

    // Puja la foto si n'hi ha una nova
    if (avatarFile) {
  // Esborra totes les fotos antigues d'aquest usuari abans de pujar la nova
  const { data: existingFiles, error: listError } = await supabase.storage
    .from('avatars')
    .list(user.id)

  console.log('existingFiles:', existingFiles, 'listError:', listError)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from('avatars').remove(filesToDelete)
  }

  const ext = avatarFile.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, avatarFile, { upsert: true })

      if (uploadError) {
        console.log('uploadError:', uploadError)
        setSaveError('Error al subir la foto')
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      // Afegim timestamp per forçar reload de la imatge
      avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
    }

    const profileUpdate = {
      name: editForm.name.trim(),
      username: editForm.username.trim().toLowerCase(),
      bio: editForm.bio.trim(),
      avatar_url: avatarUrl,
    }
    if (editForm.username.trim().toLowerCase() !== profile?.username) {
      profileUpdate.username_changed_at = new Date().toISOString()
    }

    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id)

    if (error) {
      setSaveError('Error al guardar los cambios')
      setSaving(false)
      return
    }

    await supabase.auth.updateUser({ data: { name: editForm.name.trim() } })

    await fetchAll()
    setShowEditModal(false)
    setAvatarFile(null)
    setAvatarPreview(null)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--color-text-muted)' }}>⏳ Cargando perfil...</div>
  )

  const username = profile?.username || user?.name || 'Usuario'
  const displayName = profile?.name || username
  const avatarUrl = profile?.avatar_url || null

  const tierLabel = stats.total >= 150 && stats.yieldVal >= 15 ? '💎 Elite'
    : stats.total >= 80 && stats.yieldVal >= 10 ? '🥇 Gold'
    : stats.total >= 30 && stats.yieldVal >= 5 ? '🥈 Silver'
    : stats.total >= 10 ? '🥉 Bronze'
    : null

  const currentDmOption = DM_OPTIONS.find(o => o.id === dmSetting)

  return (
    <motion.div key="miperfil" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      {/* HEADER CARD */}
      <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '20px' }}>

        {/* BANNER */}
        <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--color-primary-light) 0%, rgba(0,200,100,0.08) 100%)', borderBottom: '0.5px solid var(--color-border)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowEditModal(true); setShowConfig(false) }}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-sans)' }}>
              ✏️ Editar perfil
            </button>
            <button onClick={() => setShowConfig(!showConfig)}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)' }}>
              ⋯
            </button>
          </div>

          <AnimatePresence>
            {showConfig && (
              <>
                <div onClick={() => setShowConfig(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  style={{ position: 'absolute', top: '44px', right: '12px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '200px', overflow: 'hidden' }}>
                  {[
                    { icon: '🔐', label: 'Privacidad de mensajes', action: () => { setShowDmConfig(true); setShowConfig(false) } },
                    { icon: '📊', label: 'Mis estadísticas', action: () => { onNavigate('estadisticas'); setShowConfig(false) } },
                    { icon: '📋', label: 'Mi historial', action: () => { onNavigate('historial'); setShowConfig(false) } },
                    { icon: '⚙️', label: 'Configuración', action: () => { onNavigate('configuracion'); setShowConfig(false) } },
                  ].map((item, i, arr) => (
                    <button key={i} onClick={item.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)', textAlign: 'left', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border)' : 'none', fontFamily: 'var(--font-sans)' }}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* AVATAR + NOM */}
        <div style={{ padding: '0 28px 24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ marginTop: '-40px' }}>
              <Avatar url={avatarUrl} name={displayName} size={80} fontSize={32} />
            </div>
            {tierLabel && (
              <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '0.5px solid var(--color-primary-border)', fontWeight: 700 }}>
                {tierLabel}
              </span>
            )}
          </div>

          <div style={{ fontWeight: 700, fontSize: '22px', marginBottom: '2px' }}>{displayName}</div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: profile?.bio ? '8px' : '16px' }}>@{username}</div>
          {profile?.bio && (
            <div style={{ fontSize: '14px', color: 'var(--color-text-soft)', marginBottom: '16px', lineHeight: 1.5 }}>{profile.bio}</div>
          )}

          {/* STATS SOCIALS */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
            <StatPill label="Seguidores" value={followersCount} />
            <StatPill label="Siguiendo" value={followingCount} />
            <StatPill label="Picks" value={stats.total} />
            <div style={{ textAlign: 'center', padding: '0 20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                {stats.yieldVal >= 0 ? '+' : ''}{stats.yieldVal.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Yield</div>
            </div>
          </div>

          {/* DM SETTING BADGE */}
          <div onClick={() => setShowDmConfig(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <span>{currentDmOption?.icon}</span>
            <span>Mensajes: <strong style={{ color: 'var(--color-text)' }}>{currentDmOption?.label}</strong></span>
            <span style={{ fontSize: '10px' }}>✏️</span>
          </div>
        </div>
      </div>

      {/* TABS PICKS / STATS */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '0.5px solid var(--color-border)' }}>
        {[{ id: 'picks', label: '📋 Últimos picks' }, { id: 'stats', label: '📊 Rendimiento' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 500, color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`, cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'picks' && (
          <motion.div key="picks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {recentBets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>Sin picks todavía</div>
                <div style={{ fontSize: '13px' }}>Tus apuestas resueltas aparecerán aquí.</div>
                <button onClick={() => onNavigate('historial')}
                  style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--color-primary)', color: '#010906', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                  + Nueva apuesta
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {recentBets.map((b, i) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: i < recentBets.length - 1 ? '0.5px solid var(--color-border)' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'won' ? 'var(--color-primary)' : 'var(--color-error)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.event}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {b.sport} · <strong>{b.pick}</strong> · @{parseFloat(b.odds).toFixed(2)} · S{b.stake}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 600, background: b.status === 'won' ? 'var(--color-primary-light)' : 'var(--color-error-light)', color: b.status === 'won' ? 'var(--color-primary)' : 'var(--color-error)', border: `0.5px solid ${b.status === 'won' ? 'var(--color-primary-border)' : 'var(--color-error-border)'}` }}>
                        {b.status === 'won' ? '✓ Win' : '✗ Loss'}
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {new Date(b.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Yield total', value: `${stats.yieldVal >= 0 ? '+' : ''}${stats.yieldVal.toFixed(2)}%`, color: stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)', sub: 'Beneficio sobre apostado' },
                { label: 'W / L', value: `${stats.won} / ${stats.lost}`, color: 'var(--color-text)', sub: 'Ganadas / Perdidas' },
                { label: 'Total picks', value: stats.total, color: 'var(--color-text)', sub: 'Picks resueltos' },
                { label: 'Cuota media', value: stats.avgOdds, color: 'var(--color-warning)', sub: 'Promedio de cuotas' },
                { label: 'Win rate', value: stats.total > 0 ? `${((stats.won / stats.total) * 100).toFixed(0)}%` : '—', color: 'var(--color-text)', sub: 'Porcentaje de acierto' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL EDITAR PERFIL */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setShowEditModal(false)}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-md)', maxHeight: '90vh', overflowY: 'auto' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>✏️ Editar perfil</div>
                <button onClick={() => setShowEditModal(false)}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>

              {/* FOTO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '20px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--color-border)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar url={avatarPreview || avatarUrl} name={displayName} size={72} fontSize={28} />
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'absolute', bottom: 0, right: 0, width: '24px', height: '24px', background: 'var(--color-primary)', border: '2px solid var(--color-bg)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    📷
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Foto de perfil</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>JPG, PNG o GIF. Máx 5MB.</div>
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    Cambiar foto
                  </button>
                </div>
              </div>

              {/* CAMPS */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Nombre completo *</label>
                <input style={inputStyle} placeholder="Tu nombre" value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>@Username *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '14px' }}>@</span>
                  <input style={{ ...inputStyle, paddingLeft: '28px' }} placeholder="username" value={editForm.username}
                    onChange={e => setEditForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} />
                </div>
                {(() => {
                  if (!profile?.username_changed_at) return null
                  const daysSince = (Date.now() - new Date(profile.username_changed_at).getTime()) / 86400000
                  if (daysSince >= 14) return <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px' }}>✓ Puedes cambiar tu @username</div>
                  const daysLeft = Math.ceil(14 - daysSince)
                  return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>🔒 Podrás cambiarlo en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</div>
                })()}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Bio</label>
                <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                  placeholder="Cuéntale a la comunidad quién eres como tipster..."
                  value={editForm.bio} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  maxLength={160} />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{editForm.bio.length}/160</div>
              </div>

              {saveError && (
                <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '16px' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveProfile} disabled={saving}
                  style={{ flex: 1, background: saving ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: saving ? 'var(--color-text-muted)' : '#010906', border: 'none', padding: '12px', borderRadius: 'var(--radius-md)', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setShowEditModal(false)}
                  style={{ padding: '12px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CONFIG DMs */}
      <AnimatePresence>
        {showDmConfig && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setShowDmConfig(false)}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>🔐 Privacidad de mensajes</div>
                <button onClick={() => setShowDmConfig(false)}
                  style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
                Controla quién puede enviarte mensajes directos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {DM_OPTIONS.map(opt => (
                  <div key={opt.id} onClick={() => handleSaveDm(opt.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: `0.5px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary-light)' : 'var(--color-bg-soft)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '22px' }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-text)' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${dmSetting === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`, background: dmSetting === opt.id ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dmSetting === opt.id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#010906' }} />}
                    </div>
                  </div>
                ))}
              </div>
              {savingDm && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '12px', textAlign: 'center' }}>Guardando...</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}