import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { stagger } from '../../../lib/animations'
import { supabase } from '../../../lib/supabase'
import { Button } from '../../../components/ui/Button'
import { useChannels } from './hooks/useChannels'
import ChannelCard from './ChannelCard'
import ChatView from './ChatView'
import PreviewView from './PreviewView'
import '../dashboard.css'

const inputStyle = { width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '12px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-soft)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }

export default function Canales({ user, initialCanalCode, onAddBet }) {
  const { myChannels, joinedChannels, memberCounts, loading, createChannel, deleteChannel, searchChannels, findChannelByCode, joinChannel, leaveChannel, refetch, MAX_OWN_CHANNELS, MAX_JOINED_CHANNELS } = useChannels(user)
  const [activeChannel, setActiveChannel] = useState(null)
  const [activeMemberCount, setActiveMemberCount] = useState(0)
  const [previewChannel, setPreviewChannel] = useState(null)
  const [previewMemberCount, setPreviewMemberCount] = useState(0)
  const [joiningPreview, setJoiningPreview] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', isPrivate: false })
  const [createError, setCreateError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    if (!initialCanalCode || loading) return
    handleOpenByCode(initialCanalCode)
  }, [initialCanalCode, loading])

  const handleOpenByCode = async (code) => {
    const channel = await findChannelByCode(code)
    if (!channel) return
    const isMember = joinedChannels.some(j => j.id === channel.id) || myChannels.some(m => m.id === channel.id)
    if (isMember) handleOpenChannel(channel)
    else await handlePreviewChannel(channel)
  }

  const handleOpenChannel = (channel) => {
    setActiveMemberCount(memberCounts[channel.id] || 1)
    setActiveChannel(channel)
  }

  const handlePreviewChannel = async (channel) => {
    const { count } = await supabase
      .from('channel_members').select('*', { count: 'exact', head: true })
      .eq('channel_id', channel.id)
    setPreviewMemberCount((count || 0) + 1)
    setPreviewChannel(channel)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleJoinFromPreview = async () => {
    if (!previewChannel) return
    setJoiningPreview(true)
    const result = await joinChannel(previewChannel.id)
    setJoiningPreview(false)
    if (result?.error) return
    setActiveMemberCount(previewMemberCount)
    setActiveChannel(previewChannel)
    setPreviewChannel(null)
    await refetch()
  }

  const handleCreate = async () => {
    setCreateError('')
    const result = await createChannel(createForm.name, createForm.description, createForm.isPrivate)
    if (result?.error) { setCreateError(result.error); return }
    setCreateForm({ name: '', description: '', isPrivate: false })
    setShowCreate(false)
  }

  const handleSearch = async (q) => {
    setSearchQuery(q)
    setJoinError('')
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const results = await searchChannels(q)
    setSearchResults(results)
    setSearching(false)
  }

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return
    setInviteError('')
    setInviteLoading(true)
    const channel = await findChannelByCode(inviteCode)
    if (!channel) {
      setInviteError('Código de invitación no válido')
      setInviteLoading(false)
      return
    }
    const isAlreadyMember = joinedChannels.some(j => j.id === channel.id) || myChannels.some(m => m.id === channel.id)
    if (isAlreadyMember) {
      setInviteLoading(false)
      setInviteCode('')
      setShowSearch(false)
      handleOpenChannel(channel)
      return
    }
    await handlePreviewChannel(channel)
    setInviteLoading(false)
    setInviteCode('')
  }

  if (previewChannel) {
    const isAlreadyMember = joinedChannels.some(j => j.id === previewChannel.id) || myChannels.some(m => m.id === previewChannel.id)
    if (isAlreadyMember) {
      return <ChatView channel={previewChannel} user={user} onBack={() => setPreviewChannel(null)} memberCount={previewMemberCount} onOpenCanal={handleOpenByCode} onAddBet={onAddBet} />
    }
    return <PreviewView channel={previewChannel} user={user} onBack={() => setPreviewChannel(null)} onJoin={handleJoinFromPreview} joining={joiningPreview} memberCount={previewMemberCount} />
  }

  if (activeChannel) {
    return <ChatView
      channel={activeChannel}
      user={user}
      onBack={() => setActiveChannel(null)}
      memberCount={activeMemberCount}
      onLeave={() => { leaveChannel(activeChannel.id); setActiveChannel(null) }}
      onOpenCanal={handleOpenByCode}
      onAddBet={onAddBet}
    />
  }

  const canCreateMore = myChannels.length < MAX_OWN_CHANNELS

  return (
    <motion.div key="canales" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 700, marginBottom: '4px' }}>Canales</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Mis canales: {myChannels.length}/{MAX_OWN_CHANNELS} · Unidos: {joinedChannels.length}/{MAX_JOINED_CHANNELS}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={() => { setShowSearch(!showSearch); setShowCreate(false) }}>🔍 Buscar canal</Button>
          {canCreateMore && <Button size="sm" onClick={() => { setShowCreate(!showCreate); setShowSearch(false) }}>+ Crear canal</Button>}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Crear canal</div>
            {createError && (
              <div style={{ background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', color: 'var(--color-error)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '14px' }}>
                {createError}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Nombre *</label>
              <input type="text" placeholder="ej. MarcGol Tips" value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Descripción (opcional)</label>
              <input type="text" placeholder="De qué va tu canal..." value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '14px', background: 'var(--color-bg-soft)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', cursor: 'pointer' }}
              onClick={() => setCreateForm({ ...createForm, isPrivate: !createForm.isPrivate })}>
              <div style={{ width: '40px', height: '22px', borderRadius: '999px', background: createForm.isPrivate ? 'var(--color-primary)' : 'var(--color-border)', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '3px', left: createForm.isPrivate ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>🔒 Canal privado</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Solo accesible con enlace de invitación. No aparece en la búsqueda.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={handleCreate} disabled={!createForm.name.trim()}>Crear canal</Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError('') }}>Cancelar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Buscar canales</div>
            <input type="text" placeholder="Busca por nombre del canal..."
              value={searchQuery} onChange={e => handleSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: '16px' }} />
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>🔒 Código de invitación (canal privado)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="Ej. ABC12345" value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value.toUpperCase()); setInviteError('') }}
                  style={{ ...inputStyle, width: 'auto', flex: 1 }} />
                <Button size="sm" disabled={!inviteCode.trim() || inviteLoading} onClick={handleJoinByCode}>
                  {inviteLoading ? '...' : 'Acceder'}
                </Button>
              </div>
              {inviteError && <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '6px' }}>{inviteError}</div>}
            </div>
            {joinError && (
              <div style={{ background: 'var(--color-error-light)', color: 'var(--color-error)', padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '12px' }}>
                {joinError}
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Buscando...</div>}
            {searchResults.map(c => {
              const alreadyJoined = joinedChannels.some(j => j.id === c.id)
              const isOwn = myChannels.some(m => m.id === c.id)
              return (
                <div key={c.id} onClick={() => handlePreviewChannel(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '0.5px solid var(--color-border)', cursor: 'pointer' }}>
                  <div style={{ width: '38px', height: '38px', background: 'var(--color-bg-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0, border: '0.5px solid var(--color-border)' }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>#{c.name}</div>
                    {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{c.description}</div>}
                  </div>
                  {alreadyJoined || isOwn ? (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '5px 12px' }}>Ya unido ✓</span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-primary)', padding: '5px 12px', fontWeight: 600 }}>Ver canal →</span>
                  )}
                </div>
              )
            })}
            {searchQuery && !searching && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', paddingTop: '8px' }}>No se encontraron canales públicos</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {myChannels.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Mis canales ({myChannels.length}/{MAX_OWN_CHANNELS})
          </div>
          <motion.div initial="hidden" animate="visible" variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {myChannels.map(c => (
              <ChannelCard key={c.id} channel={c} isOwner={true}
                memberCount={memberCounts[c.id]}
                onClick={() => handleOpenChannel(c)}
                onDelete={deleteChannel}
              />
            ))}
          </motion.div>
        </div>
      )}

      {joinedChannels.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Canales unidos ({joinedChannels.length}/{MAX_JOINED_CHANNELS})
          </div>
          <motion.div initial="hidden" animate="visible" variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {joinedChannels.map(c => (
              <ChannelCard key={c.id} channel={c} isOwner={false}
                memberCount={memberCounts[c.id]}
                onClick={() => handleOpenChannel(c)}
                onLeave={() => leaveChannel(c.id)}
              />
            ))}
          </motion.div>
        </div>
      )}

      {!loading && myChannels.length === 0 && joinedChannels.length === 0 && !showCreate && !showSearch && (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-title">Sin canales todavía</div>
          <div className="empty-sub">Crea tu propio canal o únete al de otro tipster.</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Button onClick={() => setShowCreate(true)}>+ Crear canal</Button>
            <Button variant="ghost" onClick={() => setShowSearch(true)}>🔍 Buscar</Button>
          </div>
        </div>
      )}

    </motion.div>
  )
}