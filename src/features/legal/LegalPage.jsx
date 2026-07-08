import { useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { getLegalDocs, LEGAL_ORDER, LAST_UPDATED, COMPANY } from './legalDocs'
import './legal.css'

// Renderitza un bloc del document segons la seva forma (data-driven).
function Block({ block, i }) {
  if (block.h3) return <h3 key={i}>{block.h3}</h3>
  if (block.note) return <div key={i} className="legal-note">{block.note}</div>
  if (block.ul) return (
    <ul key={i}>
      {block.ul.map((li, j) => <li key={j}>{li}</li>)}
    </ul>
  )
  return <p key={i}>{block.p}</p>
}

export default function LegalPage() {
  const { t, i18n } = useTranslation()
  const { doc } = useParams()
  const navigate = useNavigate()
  const LEGAL_DOCS = getLegalDocs(i18n.language)
  const data = LEGAL_DOCS[doc]

  // En obrir un document, puja al principi (ve d'un enllaç del footer, etc.).
  useEffect(() => { window.scrollTo(0, 0) }, [doc])

  // Slug desconegut → redirigim al primer document legal.
  if (!data) return <Navigate to={`/legal/${LEGAL_ORDER[0]}`} replace />

  const goDoc = (slug) => navigate(`/legal/${slug}`)

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
        {/* Índex de documents legals */}
        <aside className="legal-nav">
          <div className="legal-nav-title">Legal</div>
          {LEGAL_ORDER.map(slug => (
            <button key={slug} className={`legal-nav-link${slug === doc ? ' active' : ''}`} onClick={() => goDoc(slug)}>
              {LEGAL_DOCS[slug].short}
            </button>
          ))}
        </aside>

        {/* Document */}
        <motion.article className="legal-article"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="legal-eyebrow">FindYourBet · Legal</div>
          <h1>{data.title}</h1>
          <div className="legal-updated">{t('legal.lastUpdated')} {LAST_UPDATED[i18n.language] ?? LAST_UPDATED.es}</div>

          {data.blocks.map((block, i) => <Block key={i} block={block} i={i} />)}

          <div className="legal-footer">
            {LEGAL_ORDER.filter(s => s !== doc).map(slug => (
              <a key={slug} onClick={() => goDoc(slug)}>{LEGAL_DOCS[slug].short}</a>
            ))}
            <div className="legal-copy">
              © {new Date().getFullYear()} {COMPANY.brand} · {t('landing.footer.tagline')} · +18
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  )
}
