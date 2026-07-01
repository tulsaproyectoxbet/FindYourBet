import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useFollow } from '../social/hooks/useFollow'
import ProfileView from '../social/ProfileView'
import Username from '../../../components/ui/Username'
import SharedAvatar from '../../../components/ui/Avatar'
import { THEME_STYLES, THEME_LABELS } from '../../../lib/cardThemes'
import { clampBio, MAX_BIO_LEN } from '../../../lib/bio'
import { formatMemberSince } from '../../../lib/dates'

const SORT_OPTIONS = [
  { id: 'yield',   label: 'Rendimiento' },
  { id: 'bets',    label: 'Apuestas' },
  { id: 'oldest',  label: 'Más antiguo' },
  { id: 'avgOdds', label: 'Cuota media' },
]

function Avatar({ url, name, size = 56, fontSize = 22 }) {
  return (
    <SharedAvatar url={url} name={name} size={size} fontSize={fontSize}
      borderWidth={2} bg="var(--color-primary-light)" fg="var(--color-primary)" />
  )
}


// Card horitzontal del propi perfil — ample complet
function MyProfileCard({ profile, onEdit, onSaveBio }) {
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue, setBioValue]     = useState('')
  const [savingBio, setSavingBio]   = useState(false)

  const stats = profile?._stats || {}
  const hasStats = (stats.total || 0) >= 3
  const yieldVal = stats.yieldVal || 0
  const winRate  = stats.winRate  || 0

  const handleStartEditBio = () => { setBioValue(profile?.bio || ''); setEditingBio(true) }
  const handleCancelBio    = () => setEditingBio(false)
  const handleSaveBio      = async () => {
    setSavingBio(true)
    try { await onSaveBio(bioValue); setEditingBio(false) }
    catch (e) {}
    finally { setSavingBio(false) }
  }

  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', marginBottom: '24px' }}>
      <div className="myprofile-grid">

        {/* Esquerra: avatar + nom + stats */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ flexShrink: 0 }}>
              <Avatar url={profile?.avatar_url} name={profile?.username} size={64} fontSize={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <Username username={profile?.username || '—'} isVerified={profile?.is_verified} size="lg" />
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}>Tú</span>
              </div>
              {profile?.created_at && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {formatMemberSince(profile.created_at)}
                </div>
              )}
            </div>
            <button onClick={onEdit}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              ✏️ Editar / Ver
            </button>
          </div>

          {/* Stats en fila amb separadors */}
          <div style={{ display: 'flex', borderTop: '0.5px solid var(--color-border)', paddingTop: '16px' }}>
            {[
              { label: 'YIELD',      value: hasStats ? `${yieldVal >= 0 ? '+' : ''}${yieldVal.toFixed(1)}%` : '—', color: hasStats ? (yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)') : 'var(--color-text-muted)' },
              { label: 'ACIERTOS',   value: hasStats ? `${Math.round(winRate)}%` : '—', color: hasStats ? 'var(--color-text)' : 'var(--color-text-muted)' },
              { label: 'PICKS',      value: hasStats ? stats.total : '—', color: hasStats ? 'var(--color-text)' : 'var(--color-text-muted)' },
              { label: 'SEGUIDORES', value: (profile?._followerCount ?? 0).toLocaleString('es-ES'), color: 'var(--color-text)' },
            ].map((s, i) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '0 8px', borderRight: i < 3 ? '0.5px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '6px', letterSpacing: '0.8px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Separador vertical */}
        <div className="myprofile-sep" style={{ background: 'var(--color-border)', alignSelf: 'stretch' }} />

        {/* Dreta: Sobre mí + bio editable + tags */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Mi Biografía</div>
            {!editingBio && (
              <button onClick={handleStartEditBio}
                style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                ✏️ Editar
              </button>
            )}
          </div>

          {editingBio ? (
            <>
              <textarea
                value={bioValue}
                onChange={e => setBioValue(clampBio(e.target.value))}
                maxLength={MAX_BIO_LEN}
                rows={4}
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-primary)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 12px', borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>{bioValue.length}/{MAX_BIO_LEN}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={handleCancelBio}
                  style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveBio} disabled={savingBio}
                  style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: savingBio ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: savingBio ? 'var(--color-text-muted)' : '#010906', cursor: savingBio ? 'default' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  {savingBio ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: profile?.bio ? 'var(--color-text)' : 'var(--color-text-muted)', lineHeight: 1.55, marginBottom: '14px', fontStyle: profile?.bio ? 'normal' : 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
              {profile?.bio || 'Sin bio'}
            </div>
          )}

          {profile?.is_verified && !editingBio && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
              ✓ Verificado
            </span>
          )}
        </div>

      </div>
    </div>
  )
}

// `preview`: mode previsualització (modal d'editar ficha) — sense botó de seguir, no
// interactiu i amb el tema que s'està editant (themeOverride). És la MATEIXA card que
// veuen els altres, per garantir que previsualització i ficha real són idèntiques.
function TipsterCard({ tipster, isFollowing, isMutual, onFollow, onUnfollow, onClick, preview = false, themeOverride }) {
  const { stats } = tipster
  const hasStats = stats.total >= 3
  const activeTheme = preview ? themeOverride : tipster.card_theme
  const themeStyle = (activeTheme && THEME_STYLES[activeTheme]) || null
  const statBg = themeStyle ? 'rgba(255,255,255,0.06)' : 'var(--color-bg-soft)'

  // Bio plegable: 2 línies per defecte; si és més llarga, mostra "Ver más...".
  const bioRef = useRef(null)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [bioOverflow, setBioOverflow] = useState(false)
  useEffect(() => {
    const el = bioRef.current
    if (el && !bioExpanded) setBioOverflow(el.scrollHeight > el.clientHeight + 1)
  }, [tipster.bio, bioExpanded])

  return (
    <div
      style={{ ...(themeStyle || { background: 'var(--color-bg)' }), border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s', display: 'flex', flexDirection: 'column', height: '100%' }}
      onMouseEnter={preview ? undefined : (e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(15,110,86,0.1)' })}
      onMouseLeave={preview ? undefined : (e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none' })}>

      <div onClick={preview ? undefined : onClick} style={{ padding: '16px 16px 14px', cursor: preview ? 'default' : 'pointer', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Fila: avatar + username + botó — centrats verticalment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            <Avatar url={tipster.avatar_url} name={tipster.username} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Username username={tipster.username} isVerified={tipster.is_verified} size="md" />
          </div>
          {!preview && (
            <button
              onClick={e => { e.stopPropagation(); isFollowing ? onUnfollow() : onFollow() }}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--radius-md)', border: isFollowing ? '0.5px solid var(--color-border)' : 'none', background: isFollowing ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: isFollowing ? 'var(--color-text-muted)' : '#010906', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {isMutual ? '👥 Amigos' : isFollowing ? '✓ Siguiendo' : '+ Seguir'}
            </button>
          )}
        </div>

        {/* Stats — SOBRE la bio */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1, padding: '8px 10px', background: statBg, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: hasStats ? (stats.yieldVal >= 0 ? 'var(--color-primary)' : 'var(--color-error)') : 'var(--color-text-muted)' }}>
              {hasStats ? `${stats.yieldVal >= 0 ? '+' : ''}${stats.yieldVal.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>yield</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', background: statBg, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: hasStats ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
              {hasStats ? `${Math.round(stats.winRate)}%` : '—'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>aciertos</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', background: statBg, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: hasStats ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
              {hasStats ? stats.total : '—'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>picks</div>
          </div>
        </div>

        {/* Bio — 2 línies per defecte; "Ver más..." expandeix la card fins al final */}
        {tipster.bio && (
          <div style={{ marginBottom: '10px' }}>
            <div ref={bioRef}
              style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5,
                ...(bioExpanded ? {} : { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }) }}>
              {tipster.bio}
            </div>
            {(bioOverflow || bioExpanded) && (
              <span onClick={e => { e.stopPropagation(); setBioExpanded(v => !v) }}
                style={{ display: 'inline-block', marginTop: '2px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', cursor: 'pointer' }}>
                {bioExpanded ? 'Ver menos' : 'Ver más...'}
              </span>
            )}
          </div>
        )}

        {/* Bottom: seguidors + avatars en comú */}
        <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {(tipster._followerCount || 0).toLocaleString('es-ES')} seguidores
          </div>
          {tipster._mutualConnections > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {/* Avatars dels seguits en comú */}
              {tipster._mutualAvatars?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {tipster._mutualAvatars.map((u, i) => (
                    <div key={u.id} style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1.5px solid var(--color-bg)', marginLeft: i > 0 ? '-5px' : '0', zIndex: 3 - i, overflow: 'hidden', background: 'var(--color-primary-light)', flexShrink: 0 }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--color-primary)', fontWeight: 700 }}>?</div>
                      }
                    </div>
                  ))}
                </div>
              )}
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                En común{tipster._mutualConnections > 3 ? ` +${tipster._mutualConnections - tipster._mutualAvatars?.length || tipster._mutualConnections}` : ''}
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '12px', marginTop: '4px' }}>
      {label}
    </div>
  )
}

function TipsterGrid({ tipsters, isFollowing, isMutual, onFollow, onUnfollow, onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {tipsters.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} style={{ height: '100%' }}>
          <TipsterCard
            tipster={t}
            isFollowing={isFollowing(t.id)}
            isMutual={isMutual(t.id)}
            onFollow={() => onFollow(t.id, t.username)}
            onUnfollow={() => onUnfollow(t.id)}
            onClick={() => onOpen(t.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}

function enrichWithStats(profiles, bets) {
  const statsMap = {}
  for (const b of (bets || [])) {
    if (b.status !== 'won' && b.status !== 'lost') continue
    if (!statsMap[b.user_id]) statsMap[b.user_id] = { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0, oddsSum: 0 }
    const s = statsMap[b.user_id]
    s.total++; s.stakeSum += b.stake; s.oddsSum += b.odds || 0
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

export default function Tipsters({ user, onNavigateToChannel, onStartDM, onRefreshUser }) {
  const [activeTab, setActiveTab] = useState('sugeridos')
  const [query, setQuery]         = useState('')

  // Sugeridos
  const [verifiedTipsters, setVerifiedTipsters] = useState(null)
  const [contactTipsters, setContactTipsters]   = useState(null)
  const [forYouTipsters, setForYouTipsters]     = useState(null)
  const [sugeridosLoading, setSugeridosLoading] = useState(false)
  const [onlyVerified, setOnlyVerified]         = useState(false) // toggle: mostrar només verificats

  // Siguiendo
  const [following, setFollowing]               = useState(null)
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingSort, setFollowingSort]       = useState('yield')
  const [sortOpen, setSortOpen]                 = useState(false)

  // Search
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]         = useState(false)
  const searchTimeout     = useRef(null)
  const sugeridosLoadedRef = useRef(false)
  const siguiendoLoadedRef = useRef(false)

  // Propi perfil
  const [myProfile, setMyProfile]       = useState(null)
  const [showCardEdit, setShowCardEdit] = useState(false)
  const [editTheme, setEditTheme]         = useState(0)
  const [savingTheme, setSavingTheme]     = useState(false)

  const [selectedUserId, setSelectedUserId] = useState(null)
  const { follow, unfollow, isFollowing, isFollower, isMutual } = useFollow(user?.id)

  useEffect(() => {
    if (user?.id) {
      loadSugeridos()
      loadSiguiendo()
      loadMyProfile()
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMyProfile = async () => {
    const safetyTimer = setTimeout(() => {}, 8000)
    try {
      const [
        { data: profile },
        { count: followerCount },
        { data: bets },
      ] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, bio, is_verified, card_theme, created_at').eq('id', user.id).single(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('bets').select('stake, status, odds').eq('user_id', user.id).in('status', ['won', 'lost']),
      ])
      if (profile) {
        const s = { won: 0, total: 0, profit: 0, stakeSum: 0 }
        for (const b of (bets || [])) {
          s.total++; s.stakeSum += b.stake
          if (b.status === 'won') { s.won++; s.profit += b.stake * (b.odds - 1) }
          else { s.profit -= b.stake }
        }
        const yieldVal = s.stakeSum > 0 ? (s.profit / s.stakeSum) * 100 : 0
        const winRate  = s.total > 0 ? (s.won / s.total) * 100 : 0
        setMyProfile({ ...profile, _followerCount: followerCount || 0, _stats: { ...s, yieldVal, winRate } })
        setEditTheme(profile.card_theme || 0)
      }
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
    }
  }

  // Desa la bio i VERIFICA que la BD l'ha acceptat (.select() retorna la fila modificada).
  // Si RLS o la sessió la bloquegen, abans es veia "editada" en local però es perdia en
  // recarregar; ara surt error i no es menteix a l'usuari. En èxit, sincronitza el `user`
  // global perquè la resta de pantalles (Perfil, etc.) ho reflecteixin igual.
  const handleSaveBio = async (newBio) => {
    const { data, error } = await supabase
      .from('profiles').update({ bio: newBio }).eq('id', user.id).select().single()
    if (error || !data) {
      alert('No se pudo guardar la biografía' + (error ? `: ${error.message}` : ' (sin permisos o sesión caducada).'))
      throw new Error('save-bio-failed')
    }
    setMyProfile(p => ({ ...p, bio: newBio }))
    onRefreshUser?.()
  }

  const handleSaveTheme = async () => {
    setSavingTheme(true)
    const safetyTimer = setTimeout(() => setSavingTheme(false), 5000)
    try {
      await supabase.from('profiles').update({ card_theme: editTheme }).eq('id', user.id)
      setMyProfile(p => ({ ...p, card_theme: editTheme }))
      setShowCardEdit(false)
      onRefreshUser?.()
    } catch (e) {
      // silent
    } finally {
      clearTimeout(safetyTimer)
      setSavingTheme(false)
    }
  }

  const loadSugeridos = async () => {
    if (!sugeridosLoadedRef.current) setSugeridosLoading(true)
    const safetyTimer = setTimeout(() => setSugeridosLoading(false), 8000)
    try {
      const uid = user?.id || ''

      const [
        { data: profiles },
        { data: bets },
        { data: myFollowing },
        { data: myFollowers },
        { data: channelOwners },
      ] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, bio, is_verified, card_theme').neq('id', uid).limit(200),
        supabase.from('bets').select('user_id, stake, status, odds').in('status', ['won', 'lost']).limit(500),
        supabase.from('follows').select('following_id').eq('follower_id', uid),
        supabase.from('follows').select('follower_id').eq('following_id', uid),
        supabase.from('channels').select('owner_id').is('deleted_at', null),
      ])

      const followingSet  = new Set((myFollowing  || []).map(f => f.following_id))
      const followerSet   = new Set((myFollowers  || []).map(f => f.follower_id))
      const tipsterOwners = new Set((channelOwners || []).map(c => c.owner_id))
      const profileIds    = (profiles || []).map(p => p.id)

      // Segon grau + comptadors de seguidors + avatars dels seguits en paral·lel
      const secondDegreeMap = {}
      const followingArr = [...followingSet]
      const [fofResult, followerResult, followingProfilesResult] = await Promise.all([
        followingArr.length > 0 && followingArr.length <= 50
          ? supabase.from('follows').select('follower_id, following_id').in('follower_id', followingArr).neq('following_id', uid).limit(500)
          : Promise.resolve({ data: [] }),
        profileIds.length > 0
          ? supabase.from('follows').select('following_id').in('following_id', profileIds)
          : Promise.resolve({ data: [] }),
        followingArr.length > 0 && followingArr.length <= 50
          ? supabase.from('profiles').select('id, avatar_url').in('id', followingArr)
          : Promise.resolve({ data: [] }),
      ])
      const followingAvatarMap = {}
      for (const p of (followingProfilesResult.data || [])) followingAvatarMap[p.id] = p.avatar_url

      // Per cada tipster candidat: quins dels meus seguits també el segueixen (màx 3 avatars)
      const secondDegreeUserMap = {}
      for (const f of (fofResult.data || [])) {
        if (!followingSet.has(f.following_id)) {
          secondDegreeMap[f.following_id] = (secondDegreeMap[f.following_id] || 0) + 1
          if (!secondDegreeUserMap[f.following_id]) secondDegreeUserMap[f.following_id] = []
          if (secondDegreeUserMap[f.following_id].length < 3)
            secondDegreeUserMap[f.following_id].push({ id: f.follower_id, avatar_url: followingAvatarMap[f.follower_id] })
        }
      }
      const followerCountMap = {}
      for (const f of (followerResult.data || [])) {
        followerCountMap[f.following_id] = (followerCountMap[f.following_id] || 0) + 1
      }

      const channelCountMap = {}
      for (const c of (channelOwners || [])) {
        channelCountMap[c.owner_id] = (channelCountMap[c.owner_id] || 0) + 1
      }

      const statsMap = {}
      for (const b of (bets || [])) {
        if (!statsMap[b.user_id]) statsMap[b.user_id] = { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
        const s = statsMap[b.user_id]
        s.total++; s.stakeSum += b.stake
        if (b.status === 'won') { s.won++; s.profit += b.stake * (b.odds - 1) }
        else { s.lost++; s.profit -= b.stake }
      }

      const candidates = (profiles || [])
        .filter(p => !followingSet.has(p.id) && tipsterOwners.has(p.id))
        .map(p => {
          const s = statsMap[p.id] || { won: 0, lost: 0, total: 0, profit: 0, stakeSum: 0 }
          const yieldVal     = s.stakeSum > 0 ? (s.profit / s.stakeSum) * 100 : 0
          const winRate      = s.total > 0 ? (s.won / s.total) * 100 : 0
          const isFlwr       = followerSet.has(p.id)
          const secondDeg    = secondDegreeMap[p.id] || 0
          const socialScore  = Math.min(100, (isFlwr ? 35 : 0) + Math.min(40, secondDeg * 8))
          const perfScore    = s.total >= 5 ? Math.min(100, Math.max(0, 50 + yieldVal * 2) * 0.55 + winRate * 0.45) : s.total > 0 ? 15 : 5
          const credScore    = Math.min(100, (s.total / 30) * 100)
          const profileScore = (p.bio ? 50 : 0) + (p.avatar_url ? 50 : 0)
          const finalScore   = socialScore * 0.40 + perfScore * 0.35 + credScore * 0.15 + profileScore * 0.10
          return {
            ...p,
            stats: { ...s, yieldVal, winRate },
            _score: finalScore,
            _mutualConnections: secondDeg,
            _mutualAvatars: secondDegreeUserMap[p.id] || [],
            _channelCount: channelCountMap[p.id] || 0,
            _followerCount: followerCountMap[p.id] || 0,
          }
        })
        .sort((a, b) => b._score - a._score)

      const verified    = candidates.filter(p => p.is_verified)
      const contacts    = candidates.filter(p => !p.is_verified && p._mutualConnections > 0).sort((a, b) => b._mutualConnections - a._mutualConnections).slice(0, 12)
      const contactIds  = new Set(contacts.map(p => p.id))
      // Descubre inclou TOTHOM (verificats inclosos); només exclou els d'"En común".
      // Els verificats també tenen la seva vista pròpia amb el toggle "Solo verificados".
      const forYou      = candidates.filter(p => !contactIds.has(p.id)).slice(0, 20)

      setVerifiedTipsters(verified)
      setContactTipsters(contacts)
      setForYouTipsters(forYou)
    } catch (e) {
      setVerifiedTipsters(v => v ?? [])
      setContactTipsters(v => v ?? [])
      setForYouTipsters(v => v ?? [])
    } finally {
      sugeridosLoadedRef.current = true
      clearTimeout(safetyTimer)
      setSugeridosLoading(false)
    }
  }

  const loadSiguiendo = async () => {
    if (!user?.id) return
    if (!siguiendoLoadedRef.current) setFollowingLoading(true)
    const safetyTimer = setTimeout(() => setFollowingLoading(false), 8000)
    try {
      const { data: followRows } = await supabase
        .from('follows').select('following_id, created_at').eq('follower_id', user.id)

      if (!followRows?.length) { setFollowing([]); return }

      const ids = followRows.map(f => f.following_id)
      const followDateMap = {}
      followRows.forEach(f => { followDateMap[f.following_id] = f.created_at })

      const [{ data: profiles }, { data: bets }, { data: channelOwners }, { data: followerRows }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, bio, is_verified, card_theme').in('id', ids),
        supabase.from('bets').select('user_id, stake, status, odds').in('user_id', ids).in('status', ['won', 'lost']).limit(500),
        supabase.from('channels').select('owner_id').in('owner_id', ids).is('deleted_at', null),
        supabase.from('follows').select('following_id').in('following_id', ids),
      ])

      const channelCountMap = {}
      for (const c of (channelOwners || [])) channelCountMap[c.owner_id] = (channelCountMap[c.owner_id] || 0) + 1

      const followerCountMap = {}
      for (const f of (followerRows || [])) followerCountMap[f.following_id] = (followerCountMap[f.following_id] || 0) + 1

      const enriched = enrichWithStats(profiles || [], bets || [])
        .map(p => ({ ...p, _followedAt: followDateMap[p.id], _channelCount: channelCountMap[p.id] || 0, _mutualConnections: 0, _followerCount: followerCountMap[p.id] || 0 }))

      setFollowing(enriched)
    } catch (e) {
      setFollowing(v => v ?? [])
    } finally {
      siguiendoLoadedRef.current = true
      clearTimeout(safetyTimer)
      setFollowingLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setQuery('')
    setSearchResults([])
    setSortOpen(false)
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
      .from('profiles').select('id, username, name, avatar_url, bio, is_verified, card_theme')
      .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
      .neq('id', user?.id || '').limit(20)

    if (!profiles?.length) { setSearchResults([]); setSearching(false); return }

    const ids = profiles.map(p => p.id)
    const [{ data: bets }, { data: channelOwners }, { data: followerRows }] = await Promise.all([
      supabase.from('bets').select('user_id, odds, stake, status').in('user_id', ids).in('status', ['won', 'lost']).limit(500),
      supabase.from('channels').select('owner_id').in('owner_id', ids).is('deleted_at', null),
      supabase.from('follows').select('following_id').in('following_id', ids),
    ])
    const channelCountMap = {}
    for (const c of (channelOwners || [])) channelCountMap[c.owner_id] = (channelCountMap[c.owner_id] || 0) + 1
    const followerCountMap = {}
    for (const f of (followerRows || [])) followerCountMap[f.following_id] = (followerCountMap[f.following_id] || 0) + 1

    const enriched = enrichWithStats(profiles, bets || [])
      .map(p => ({ ...p, _channelCount: channelCountMap[p.id] || 0, _mutualConnections: 0, _followerCount: followerCountMap[p.id] || 0 }))
    setSearchResults(enriched)
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

  const sortedFollowing = following
    ? [...following].sort((a, b) => {
        if (followingSort === 'yield')   return b.stats.yieldVal - a.stats.yieldVal
        if (followingSort === 'bets')    return b.stats.total - a.stats.total
        if (followingSort === 'oldest')  return new Date(a._followedAt) - new Date(b._followedAt)
        if (followingSort === 'avgOdds') return b.stats.avgOdds - a.stats.avgOdds
        return 0
      })
    : []

  const cardCallbacks = {
    isFollowing,
    isMutual,
    onFollow:  (id, username) => follow(id, username || 'alguien'),
    onUnfollow: (id) => unfollow(id),
    onOpen:    (id) => setSelectedUserId(id),
  }

  return (
    <motion.div key="tipsters" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      {/* Títol */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700, marginBottom: '4px' }}>Tipsters</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Descubre los mejores pronosticadores</p>
      </div>

      {/* Fila: tabs esquerra + sort dreta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px' }}>
          {[
            { id: 'sugeridos', label: '✨ Sugeridos' },
            { id: 'siguiendo', label: '👤 Siguiendo' },
          ].map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', background: activeTab === t.id ? 'var(--color-primary)' : 'transparent', color: activeTab === t.id ? '#010906' : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sort — només al tab siguiendo amb resultats */}
        {activeTab === 'siguiendo' && following?.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSortOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Ordenar por:</span>
              <span>{SORT_OPTIONS.find(o => o.id === followingSort)?.label}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
            </button>
            <AnimatePresence>
              {sortOpen && (
                <>
                  <div onClick={() => setSortOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', zIndex: 10, minWidth: '180px', overflow: 'hidden' }}>
                    {SORT_OPTIONS.map((opt, i) => (
                      <button key={opt.id} onClick={() => { setFollowingSort(opt.id); setSortOpen(false) }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 16px', background: followingSort === opt.id ? 'var(--color-primary-light)' : 'none', border: 'none', borderBottom: i < SORT_OPTIONS.length - 1 ? '0.5px solid var(--color-border)' : 'none', cursor: 'pointer', fontSize: '13px', fontWeight: followingSort === opt.id ? 700 : 500, color: followingSort === opt.id ? 'var(--color-primary)' : 'var(--color-text)', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                        {opt.label}
                        {followingSort === opt.id && <span>✓</span>}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Buscador — ample complet */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Busca tipsters por nombre o usuario..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          maxLength={50}
          style={{ width: '100%', background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 16px 12px 42px', borderRadius: 'var(--radius-lg)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', pointerEvents: 'none', opacity: 0.4 }}>🔍</span>
      </div>

      {/* Tu perfil — ample complet */}
      {myProfile && (
        <MyProfileCard
          profile={myProfile}
          onEdit={() => { setEditTheme(myProfile.card_theme || 0); setShowCardEdit(true) }}
          onSaveBio={handleSaveBio}
        />
      )}

      {/* Resultats de cerca */}
      {showSearch && (
        <>
          {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '20px' }}>Buscando tipsters...</div>}
          {!searching && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 20px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔎</div>
              No se encontraron tipsters con ese nombre
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <TipsterGrid tipsters={searchResults} {...cardCallbacks} />
          )}
        </>
      )}

      {/* Contingut per tab */}
      {!showSearch && (
        <>
          {/* ── SUGERIDOS ── */}
          {activeTab === 'sugeridos' && (
            <>
              {sugeridosLoading && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '60px 20px' }}>
                  ⏳ Cargando tipsters...
                </div>
              )}
              {!sugeridosLoading && (
                <>
                  {/* Toggle: mostrar només verificats (per defecte OFF → En común / Descubre) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '10px' }}>
                    <button onClick={() => setOnlyVerified(v => !v)}
                      title="Mostrar solo tipsters verificados"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: onlyVerified ? 'var(--color-primary-light)' : 'var(--color-bg)', border: `0.5px solid ${onlyVerified ? 'var(--color-primary-border)' : 'var(--color-border)'}`, color: onlyVerified ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: '13px', fontWeight: 700, padding: '7px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                      {/* "Semàfor": punt verd quan està actiu */}
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: onlyVerified ? 'var(--color-primary)' : 'var(--color-border)', boxShadow: onlyVerified ? '0 0 6px var(--color-primary)' : 'none', transition: 'all 0.15s' }} />
                      ✓ Solo verificados
                    </button>
                    <button onClick={loadSugeridos}
                      style={{ background: 'none', border: '0.5px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      🔄 Actualizar
                    </button>
                  </div>

                  {onlyVerified ? (
                    /* Només verificats */
                    verifiedTipsters?.length > 0 ? (
                      <TipsterGrid tipsters={verifiedTipsters} {...cardCallbacks} />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
                        <div style={{ fontWeight: 600 }}>No hay tipsters verificados por ahora</div>
                      </div>
                    )
                  ) : (() => {
                    // En común / Descubre. Si només una secció té tipsters, ocupa tot l'ample
                    // (una sola graella, ~4 columnes). Si totes dues en tenen, graella de 2 columnes.
                    const hasCommon = contactTipsters?.length > 0
                    const hasDiscover = forYouTipsters?.length > 0
                    const sectionHead = (label) => (
                      <div style={{ display: 'flex', alignItems: 'center', minHeight: '30px', marginTop: '4px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{label}</span>
                      </div>
                    )
                    if (hasCommon && hasDiscover) {
                      return (
                        <div className="tipsters-pair-grid">
                          <div>{sectionHead('👥 En común')}<TipsterGrid tipsters={contactTipsters} {...cardCallbacks} /></div>
                          <div>{sectionHead('🔥 Descubre')}<TipsterGrid tipsters={forYouTipsters} {...cardCallbacks} /></div>
                        </div>
                      )
                    }
                    if (hasCommon || hasDiscover) {
                      // Una sola secció → ample complet
                      return (
                        <div>
                          {sectionHead(hasCommon ? '👥 En común' : '🔥 Descubre')}
                          <TipsterGrid tipsters={hasCommon ? contactTipsters : forYouTipsters} {...cardCallbacks} />
                        </div>
                      )
                    }
                    if (contactTipsters !== null && forYouTipsters !== null) {
                      return (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
                          <div style={{ fontWeight: 600 }}>No hay más tipsters por descubrir</div>
                          <div style={{ fontSize: '13px', marginTop: '6px' }}>¡Ya sigues a todos los tipsters activos!</div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </>
              )}
            </>
          )}

          {/* ── SIGUIENDO ── */}
          {activeTab === 'siguiendo' && (
            <>
              {followingLoading && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', padding: '40px' }}>⏳ Cargando...</div>}

              {!followingLoading && following === null && (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                  <div style={{ fontWeight: 600, marginBottom: '12px' }}>No se han podido cargar los tipsters</div>
                  <button onClick={loadSiguiendo}
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
                  <button onClick={() => handleTabChange('sugeridos')}
                    style={{ marginTop: '16px', background: 'var(--color-primary)', color: '#010906', border: 'none', padding: '10px 22px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    Ver sugeridos
                  </button>
                </div>
              )}

              {!followingLoading && following !== null && following.length > 0 && (
                <TipsterGrid tipsters={sortedFollowing} {...cardCallbacks} />
              )}
            </>
          )}
        </>
      )}

      {/* Modal d'edició de ficha */}
      <AnimatePresence>
        {showCardEdit && myProfile && (
          <motion.div className="modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowCardEdit(false); setEditTheme(myProfile.card_theme || 0) }}>
            <motion.div className="modal"
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '480px' }}>

              <div className="modal-header">
                <div className="modal-title">Editar ficha</div>
                <button className="modal-close" onClick={() => { setShowCardEdit(false); setEditTheme(myProfile.card_theme || 0) }}>×</button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Vista previa</div>
                {/* Mateixa card que veuen els altres, en mode previsualització amb el tema editat */}
                <TipsterCard
                  tipster={{
                    ...myProfile,
                    stats: myProfile._stats || { total: 0, yieldVal: 0, winRate: 0 },
                    _followerCount: myProfile._followerCount || 0,
                    _mutualConnections: 0,
                    _mutualAvatars: [],
                  }}
                  preview
                  themeOverride={editTheme}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Tema</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {THEME_STYLES.map((thStyle, i) => {
                    const isSelected = editTheme === i
                    return (
                      <div key={i} onClick={() => setEditTheme(i)} style={{ cursor: 'pointer' }}>
                        <div style={{ position: 'relative', height: '40px', borderRadius: 'var(--radius-md)', border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`, overflow: 'hidden', ...(thStyle || { background: 'var(--color-bg-soft)' }), transition: 'border-color 0.15s', marginBottom: '6px' }}>
                          {isSelected && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 900 }}>✓</div>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', textAlign: 'center', fontWeight: isSelected ? 700 : 400 }}>
                          {THEME_LABELS[i]}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button onClick={handleSaveTheme} disabled={savingTheme}
                style={{ width: '100%', background: savingTheme ? 'var(--color-bg-soft)' : 'var(--color-primary)', color: savingTheme ? 'var(--color-text-muted)' : '#010906', border: 'none', padding: '13px', borderRadius: 'var(--radius-md)', cursor: savingTheme ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                {savingTheme ? 'Guardando...' : 'Guardar'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
