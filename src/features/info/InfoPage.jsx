import { useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { INFO_DOCS, INFO_ORDER } from './infoDocs'
import ComingSoon from '../../components/ui/ComingSoon'
import '../legal/legal.css'

function Block({ block }) {
  if (block.h3) return <h3>{block.h3}</h3>
  if (block.note) return <div className="legal-note">{block.note}</div>
  if (block.ul) return (
    <ul>
      {block.ul.map((li, j) => <li key={j}>{li}</li>)}
    </ul>
  )
  return <p>{block.p}</p>
}

export default function InfoPage() {
  const { doc } = useParams()
  const navigate = useNavigate()
  const data = INFO_DOCS[doc]

  useEffect(() => { window.scrollTo(0, 0) }, [doc])

  if (!data) return <Navigate to={`/info/${INFO_ORDER[0]}`} replace />

  return (
    <div className="legal-page">
      <div className="legal-topbar">
        <div className="legal-logo" onClick={() => navigate('/')} role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && navigate('/')}>
          FindYour<span>Bet</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="legal-back" onClick={() => navigate(-1)}>← Atrás</button>
          <button className="legal-back" onClick={() => navigate('/')}>Salir</button>
        </div>
      </div>

      <div className="legal-shell">
        <aside className="legal-nav">
          <div className="legal-nav-title">Producto</div>
          {INFO_ORDER.map(slug => (
            <button key={slug} className={`legal-nav-link${slug === doc ? ' active' : ''}`}
              onClick={() => navigate(`/info/${slug}`)}>
              {INFO_DOCS[slug].short}
            </button>
          ))}
        </aside>

        <motion.article className="legal-article"
          key={doc}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

          {data.comingSoon ? (
            <ComingSoon
              subtitle={"Los planes de precios estarán disponibles cuando lancemos las funciones de pago.\nMuy pronto podrás acceder a canales VIP y suscripciones de tipsters."}
              note="¡Se viene algo grande!"
            />
          ) : (
            <>
              <div className="legal-eyebrow">FindYourBet · Producto</div>
              <h1>{data.title}</h1>
              {data.desc && <div className="legal-updated">{data.desc}</div>}
              {data.blocks.map((block, i) => <Block key={i} block={block} />)}
              <div className="legal-footer">
                {INFO_ORDER.filter(s => s !== doc).map(slug => (
                  <a key={slug} onClick={() => navigate(`/info/${slug}`)} style={{ cursor: 'pointer' }}>
                    {INFO_DOCS[slug].short}
                  </a>
                ))}
                <div className="legal-copy">
                  © {new Date().getFullYear()} FindYourBet · Juega con responsabilidad · +18
                </div>
              </div>
            </>
          )}
        </motion.article>
      </div>
    </div>
  )
}
