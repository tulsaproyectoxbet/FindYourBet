import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from './AppIcon'

const LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
]

export default function LanguageSwitcher({ compact = false }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = LANGS.find(l => l.code === i18n.language) || LANGS[0]

  const select = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('fyb_lang', code)
    setOpen(false)
  }

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Idioma / Language / Langue"
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: compact ? '4px 6px' : '6px 10px',
          background: open ? 'var(--color-bg-soft)' : 'transparent',
          border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          transition: 'background 0.12s, border-color 0.12s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <AppIcon name="globe" size={13} />
        <span>{current.label}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--color-bg)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          zIndex: 300,
          minWidth: '72px',
        }}>
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 14px',
                background: lang.code === i18n.language ? 'var(--color-bg-soft)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: lang.code === i18n.language ? 'var(--color-primary)' : 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: lang.code === i18n.language ? 700 : 500,
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (lang.code !== i18n.language) e.currentTarget.style.background = 'var(--color-bg-soft)' }}
              onMouseLeave={e => { if (lang.code !== i18n.language) e.currentTarget.style.background = 'transparent' }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
