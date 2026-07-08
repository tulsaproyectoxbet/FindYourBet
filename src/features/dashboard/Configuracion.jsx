import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import AppIcon from '../../components/ui/AppIcon'

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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><AppIcon name={isOk ? 'check' : 'close'} size={13} />{msg.text}</span>
    </motion.div>
  )
}

function ActionBtn({ onClick, loading, disabled, danger, loadingText, children }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={loading || disabled}
      style={{ marginTop: '14px', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: danger ? '0.5px solid var(--color-error-border)' : 'none', background: loading || disabled ? 'var(--color-bg-soft)' : danger ? 'var(--color-error-light)' : 'var(--color-primary)', color: loading || disabled ? 'var(--color-text-muted)' : danger ? 'var(--color-error)' : '#010906', cursor: loading || disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
      {loading ? (loadingText || '…') : children}
    </motion.button>
  )
}

export default function Configuracion({ user, logout }) {
  const { t } = useTranslation()
  const [pwForm, setPwForm] = useState({ new: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const DELETE_WORD = t('settings.deleteWord')

  const handleChangePassword = async () => {
    setPwMsg(null)
    if (!pwForm.new || !pwForm.confirm) return setPwMsg({ type: 'error', text: t('settings.errorFillAll') })
    if (pwForm.new.length < 8) return setPwMsg({ type: 'error', text: t('settings.errorMin8') })
    if (pwForm.new !== pwForm.confirm) return setPwMsg({ type: 'error', text: t('settings.errorPasswordMatch') })
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    setPwLoading(false)
    if (error) return setPwMsg({ type: 'error', text: error.message })
    setPwMsg({ type: 'success', text: t('settings.passwordUpdated') })
    setPwForm({ new: '', confirm: '' })
  }

  const handleChangeEmail = async () => {
    setEmailMsg(null)
    if (!newEmail.trim() || !newEmail.includes('@')) return setEmailMsg({ type: 'error', text: t('settings.errorValidEmail') })
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailLoading(false)
    if (error) return setEmailMsg({ type: 'error', text: error.message })
    setEmailMsg({ type: 'success', text: t('settings.emailConfirmSent') })
    setNewEmail('')
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== DELETE_WORD) return
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
        <h2>{t('settings.title')}</h2>
        <p>{t('settings.subtitle')}</p>
      </div>

      {/* EMAIL ACTUAL */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{t('settings.currentEmail')}</div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{user?.email || '—'}</div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
            {(user?.username || user?.email || 'U')[0].toUpperCase()}
          </div>
        </div>
      </Card>

      {/* SEGURETAT */}
      <SectionTitle>{t('settings.security')}</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>{t('settings.changePassword')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <FieldLabel>{t('settings.newPassword')}</FieldLabel>
            <StyledInput type="password" value={pwForm.new} onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))} placeholder={t('auth.register.minChars')} autoComplete="new-password" />
          </div>
          <div>
            <FieldLabel>{t('settings.confirmPassword')}</FieldLabel>
            <StyledInput type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder={t('auth.register.repeatPasswordPlaceholder')} autoComplete="new-password" />
          </div>
        </div>
        <Feedback msg={pwMsg} />
        <ActionBtn onClick={handleChangePassword} loading={pwLoading} disabled={!pwForm.new || !pwForm.confirm} loadingText={t('settings.saving')}>
          {t('settings.updatePassword')}
        </ActionBtn>
      </Card>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>{t('settings.changeEmail')}</div>
        <FieldLabel>{t('settings.newEmail')}</FieldLabel>
        <StyledInput type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nuevo@email.com" autoComplete="email" />
        <Feedback msg={emailMsg} />
        <ActionBtn onClick={handleChangeEmail} loading={emailLoading} disabled={!newEmail.trim()} loadingText={t('settings.saving')}>
          {t('settings.updateEmail')}
        </ActionBtn>
      </Card>

      {/* LEGAL I PRIVACITAT */}
      <SectionTitle>{t('settings.legalPrivacy')}</SectionTitle>

      <Card>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
          {t('settings.legalDesc')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { slug: 'aviso-legal', labelKey: 'settings.legalNotice' },
            { slug: 'terminos', labelKey: 'settings.terms' },
            { slug: 'privacidad', labelKey: 'settings.privacy' },
            { slug: 'cookies', labelKey: 'settings.cookies' },
            { slug: 'juego-responsable', labelKey: 'settings.responsibleGambling' },
          ].map(l => (
            <a key={l.slug} href={`/legal/${l.slug}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 4px', fontSize: '14px', color: 'var(--color-text)', textDecoration: 'none', borderBottom: '0.5px solid var(--color-border)' }}>
              <span>{t(l.labelKey)}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>↗</span>
            </a>
          ))}
        </div>
      </Card>

      {/* SESSIÓ */}
      <SectionTitle>{t('settings.session')}</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{t('settings.signOut')}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>{t('settings.signOutDesc')}</div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={logout}
          style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          {t('settings.signOut')}
        </motion.button>
      </Card>

      {/* ZONA PERILLOSA */}
      <SectionTitle>{t('settings.dangerZone')}</SectionTitle>

      <Card>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-error)', marginBottom: '4px' }}>{t('settings.deleteAccount')}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
          {t('settings.deleteDesc')}
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeleteModal(true)}
          style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-error-border)', background: 'var(--color-error-light)', color: 'var(--color-error)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          {t('settings.deleteButton')}
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

              <div style={{ marginBottom: '8px' }}><AppIcon name="warning" size={20} color="var(--color-error)" /></div>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{t('settings.deleteConfirmTitle')}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                {t('settings.deleteConfirmDesc')}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}
                dangerouslySetInnerHTML={{ __html: t('settings.deleteType') }} />
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={DELETE_WORD}
                style={{ width: '100%', background: 'var(--color-bg-soft)', border: `0.5px solid ${deleteConfirm === DELETE_WORD ? 'var(--color-error)' : 'var(--color-border)'}`, color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '14px', padding: '10px 14px', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                  style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--color-border)', background: 'var(--color-bg-soft)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                  {t('common.cancel')}
                </button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={handleDeleteAccount} disabled={deleteConfirm !== DELETE_WORD || deleteLoading}
                  style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: deleteConfirm === DELETE_WORD ? 'var(--color-error)' : 'var(--color-bg-soft)', color: deleteConfirm === DELETE_WORD ? '#fff' : 'var(--color-text-muted)', cursor: deleteConfirm === DELETE_WORD ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}>
                  {deleteLoading ? t('settings.deleting') : t('settings.deleteAccount')}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
