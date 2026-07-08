import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AppIcon from '../../components/ui/AppIcon'

const FAQ_STRUCTURE = [
  {
    catKey: 'faqs.cat1',
    icon: 'tipsters',
    items: [
      { qKey: 'faqs.q1_1', aKey: 'faqs.a1_1' },
      { qKey: 'faqs.q1_2', aKey: 'faqs.a1_2' },
      { qKey: 'faqs.q1_3', aKey: 'faqs.a1_3' },
    ]
  },
  {
    catKey: 'faqs.cat2',
    icon: 'bookOpen',
    items: [
      { qKey: 'faqs.q2_1', aKey: 'faqs.a2_1' },
      { qKey: 'faqs.q2_2', aKey: 'faqs.a2_2' },
      { qKey: 'faqs.q2_3', aKey: 'faqs.a2_3' },
      { qKey: 'faqs.q2_4', aKey: 'faqs.a2_4' },
    ]
  },
  {
    catKey: 'faqs.cat3',
    icon: 'shield',
    items: [
      { qKey: 'faqs.q3_1', aKey: 'faqs.a3_1' },
      { qKey: 'faqs.q3_2', aKey: 'faqs.a3_2' },
    ]
  },
  {
    catKey: 'faqs.cat4',
    icon: 'trophy',
    items: [
      { qKey: 'faqs.q4_1', aKey: 'faqs.a4_1' },
      { qKey: 'faqs.q4_2', aKey: 'faqs.a4_2' },
      { qKey: 'faqs.q4_3', aKey: 'faqs.a4_3' },
    ]
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}
          style={{ fontSize: '20px', color: 'var(--color-primary)', flexShrink: 0, lineHeight: 1 }}>+</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: '0 0 16px 0', paddingRight: '32px' }}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Faqs() {
  const { t } = useTranslation()

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>{t('faqs.title')}</h2>
        <p>{t('faqs.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {FAQ_STRUCTURE.map((section, si) => (
          <div key={si} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <AppIcon name={section.icon} size={18} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t(section.catKey)}
              </div>
            </div>
            {section.items.map((item, ii) => (
              <FaqItem key={ii} q={t(item.qKey)} a={t(item.aKey)} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', padding: '16px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {t('faqs.contactFooter')}
      </div>

    </motion.div>
  )
}
