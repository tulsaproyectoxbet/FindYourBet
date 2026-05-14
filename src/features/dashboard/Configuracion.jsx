import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', marginTop: '32px' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{children}</div>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border)' }} />
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{children}</div>
}

function StyledInput({ type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
      style={{ width: '100%', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box' }}
    />
  )
}

function Feedback({ msg }) {
  if (!msg) return null
  const isOk = msg.type === 'success'
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      style={{ marginTop: '10px', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 500, background: isOk ? 'var(--color-primary-light)' : 'var(--color-error-light)', color: isOk ? 'var(--color-primary)' : 'var(--color-error)', border: `0.5px solid ${isOk ? 'var(--color-primary-border)' : 'var(--color-error-border)'}` }}>
      {isOk ? '✓ ' : '✗ '}{msg.text}
    </motion.div>
  )
}

function ActionBtn({ onClick, loading, disabled, danger, children }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={loading || disabled}
      style={{ marginTop: '14px', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: danger ? '0.5px solid var(--color-error-border)' : 'none', background: loading || disabled ? 'var(--color-bg-soft)' : danger ? 'var(--color-error-light)' : 'var(--color-primary)', color: loading || disabled ? 'var(--color-text-muted)' : danger ? 'var(--color-error)' : '#010906', cursor: loading || disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
      {loading ? 'Guardando...' : children}
    </motion.button>
  )
}

export default function Configuracion({ user, logout }) {
  const [pwForm, setPwForm] = useState({ new: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleChangePassword = async () => {
    setPwMsg(null)
    if (!pwForm.new || !pwForm.confirm) return setPwMsg({ type: 'error', text: 'Rellena todos los campos' })
    if (pwForm.new.length < 8) return setPwMsg({ type: 'error', text: 'Mínimo 8 caracteres' })
    if (pwForm.new !== pwForm.confirm) return setPwMsg({ type: 'error', text: 'Las contraseñas no coinciden' })
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    setPwLoading(false)
    if (error) return setPwMsg({ type: 'error', text: error.message })
    setPwMsg({ type: 'success', text: 'Contraseña actualizada correctamente' })
    setPwForm({ new: '', confirm: '' })
  }

  const handleChangeEmail = async () => {
    setEmailMsg(null)
    if (!newEmail.trim() || !newEmail.includes('@')) return setEmailMsg({ type: 'error', text: 'Introduce un email válido' })
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailLoading(false)
    if (error) return setEmailMsg({ type: 'error', text: error.message })
    setEmailMsg({ type: 'success', text: 'Revisa tu nuevo email para confirmar el cambio' })
    setNewEmail('')
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINAR') return
    setDeleteLoading(true)
    await Promise.all([
      supabase.from('post_likes').delete().eq('user_id', user.id),
      supabase.from('post_comments').delete().eq('user_id', user.id),
      supabase.from('notifications').delete().eq('user_id', user.id),
      supabase.from('channel_members').delete().eq('user_id', user.id),
      supabase.from('bets').delete().eq('user_id', user.id),
    ])
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    logout()
  }

  return (
    <motion.div key="configuracion"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
      style={{ maxWidth: '560px' }}>

      <div className="page-header">
        <h2>Configuración</h2>
        <p>Gestiona tu cuenta, seguridad y privacidad.</p>
      </div>

      {/* EMAIL ACTUAL */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Email actual</div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{user?.email || '—'}</div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
            {(user?.name || user?.email || 'U')[0].toUpperCase()}
          </div>
        </div>
      </Card>

      {/* SEGURETAT */}
      <SectionTitle>Seguridad</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>Cambiar contraseña</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <FieldLabel>Nueva contraseña</FieldLabel>
            <StyledInput type="password" value={pwForm.new} onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <FieldLabel>Confirmar contraseña</FieldLabel>
            <StyledInput type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Repite la contraseña" autoComplete="new-password" />
          </div>
        </div>
        <Feedback msg={pwMsg} />
        <ActionBtn onClick={handleChangePassword} loading={pwLoading} disabled={!pwForm.new || !pwForm.confirm}>
          Actualizar contraseña
        </ActionBtn>
      </Card>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>Cambiar email</div>
        <FieldLabel>Nuevo email</FieldLabel>
        <StyledInput type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuevo@email.com" autoComplete="email" />
        <Feedback msg={emailMsg} />
        <ActionBtn onClick={handleChangeEmail} loading={emailLoading} disabled={!newEmail.trim()}>
          Actualizar email
        </ActionBtn>
      </Card>

      {/* SESSIÓ */}
      <SectionTitle>Sesión</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Cerrar sesión</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>Saldrás de tu cuenta en este dispositivo.</div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={logout}
          style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          Cerrar sesión
        </motion.button>
      </Card>

      {/* ZONA PERILLOSA */}
      <SectionTitle>Zona de peligro</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-error)', marginBottom: '4px' }}>Eliminar cuenta</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
          Esta acción es permanente e irreversible. Se borrarán todas tus apuestas, picks, comentarios y datos asociados.
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeleteModal(true)}
          style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          Eliminar mi cuenta
        </motion.button>
      </Card>

      {/* MODAL CONFIRMACIÓ ELIMINACIÓ */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
              style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50 }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 51, background: 'var(--color-bg)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '420px', maxWidth: '90vw' }}>

              <div style={{ fontSize: '20px', marginBottom: '8px' }}>⚠️</div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>¿Eliminar tu cuenta?</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                Esta acción no se puede deshacer. Se eliminarán permanentemente tus apuestas, picks, canales y todos tus datos.
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Escribe <span style={{ color: 'var(--color-error)', fontFamily: 'monospace' }}>ELIMINAR</span> para confirmar:
              </div>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="ELIMINAR"
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: `0.5px solid ${deleteConfirm === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-border)'}`, color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '14px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                  Cancelar
                </button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={handleDeleteAccount} disabled={deleteConfirm !== 'ELIMINAR' || deleteLoading}
                  style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteConfirm === 'ELIMINAR' ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteConfirm === 'ELIMINAR' ? '#fff' : 'var(--color-text-muted)', cursor: deleteConfirm === 'ELIMINAR' ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}>
                  {deleteLoading ? 'Eliminando...' : 'Eliminar cuenta'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
