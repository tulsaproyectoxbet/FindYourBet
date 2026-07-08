import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import '../legal/legal.css'

const GMAIL_URL = 'https://mail.google.com/mail/?view=cm&fs=1&to=fyourbet@gmail.com'

export default function ContactPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="legal-page">
      <div className="legal-topbar">
        <div className="legal-logo" onClick={() => navigate('/')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && navigate('/')}>
          FindYour<span>Bet</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="legal-back" onClick={() => navigate(-1)}>{t('common.back')}</button>
          <button className="legal-back" onClick={() => navigate('/')}>{t('legal.exit')}</button>
        </div>
      </div>

      <div className="legal-shell">
        <aside className="legal-nav">
          <div className="legal-nav-title">{t('contactPage.sidebarTitle')}</div>
          <button className="legal-nav-link active">{t('contactPage.title')}</button>
        </aside>

        <motion.article className="legal-article"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

          <div className="legal-eyebrow">FindYourBet · {t('contactPage.sidebarTitle')}</div>
          <h1>{t('contactPage.title')}</h1>
          <div className="legal-updated">{t('contactPage.desc')}</div>

          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '460px' }}>
            <div style={{
              padding: '28px 24px',
              background: 'var(--color-bg-soft)',
              border: '0.5px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('contactPage.emailLabel')}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
                fyourbet@gmail.com
              </div>
            </div>

            <motion.a
              href={GMAIL_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '14px 28px',
                background: 'var(--color-primary)', color: '#010906',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700,
                textDecoration: 'none', cursor: 'pointer', alignSelf: 'flex-start',
              }}>
              {t('contactPage.openGmail')}
            </motion.a>
          </div>

          <div className="legal-footer">
            <div className="legal-copy">
              © {new Date().getFullYear()} FindYourBet · {t('landing.footer.tagline')} · +18
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  )
}
