import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppIcon from '../../components/ui/AppIcon'

const FAQS = [
  {
    category: 'Sobre FindYourBet',
    icon: 'tipsters',
    items: [
      {
        q: '¿Qué es FindYourBet?',
        a: 'FindYourBet (FYB) es una red social de pronósticos deportivos. Los tipsters crean canales donde comparten sus picks y análisis en tiempo real. Los usuarios siguen a los mejores tipsters, aprenden de su metodología y mejoran sus resultados con datos reales y verificables.'
      },
      {
        q: '¿Cuál es la misión de FYB?',
        a: 'Queremos hacer el mundo de los pronósticos más transparente y meritocrático. Cada tipster tiene un historial público e inalterable de todos sus picks. No hay capturas manipuladas ni resultados inventados: solo datos reales. Creemos que la transparencia es la única forma de separar a los tipsters honestos de los que no lo son.'
      },
      {
        q: '¿Es gratis usar FindYourBet?',
        a: 'Sí. Registrarte, seguir tipsters y acceder a los canales públicos es completamente gratuito. Los tipsters pueden crear canales VIP de pago con análisis exclusivos — esta funcionalidad estará disponible próximamente.'
      },
    ]
  },
  {
    category: 'Conceptos clave',
    icon: 'bookOpen',
    items: [
      {
        q: '¿Qué es el Yield?',
        a: 'El Yield mide la rentabilidad de un tipster en relación al total en stake. Se calcula así: (Beneficio neto ÷ Suma de stakes) × 100. Un Yield positivo ya es buena señal. Por encima del 5% es excelente. Lo más importante es que sea consistente en el tiempo, no solo en un período puntual.'
      },
      {
        q: '¿Qué es el Bank y cómo funciona en FYB?',
        a: 'El Bank es el capital total destinado a los pronósticos. En FYB usamos una gestión basada en el 1% del bank por pick: si tu bank es 1.000€, cada stake es 10€. A medida que el bank crece o decrece, el stake se ajusta proporcionalmente. Este sistema protege tu capital ante malas rachas y maximiza el crecimiento en buenas épocas.'
      },
      {
        q: '¿Qué es la cuota media y por qué importa?',
        a: 'La cuota media es el promedio de todas las cuotas de los picks. Cuotas más altas implican mayor varianza — es decir, más altibajos en el bankroll aunque el Yield sea positivo. Un tipster con cuota media de 1.60 será más estable que uno con 3.50, aunque ambos tengan el mismo Yield.'
      },
      {
        q: '¿Cómo funciona el Ranking?',
        a: 'El Ranking clasifica a los tipsters según su Yield de los últimos 3 meses. Para aparecer, un tipster necesita un mínimo de picks registrados en ese período. Cuantos más picks con Yield positivo sostenido, más arriba en la lista. El objetivo es premiar la consistencia, no los golpes de suerte.'
      },
    ]
  },
  {
    category: 'Seguridad y estafas',
    icon: 'shield',
    items: [
      {
        q: '¿Cómo evitar ser estafado por un tipster?',
        a: 'Aplica estas reglas de oro: (1) Desconfía de quien promete resultados garantizados — nadie gana siempre. (2) Comprueba que el historial es amplio: un mes de buenos picks no dice nada estadísticamente. (3) Mira el Yield a largo plazo, no solo el último período. (4) En FYB, los picks se registran con fecha y hora antes del partido, lo que garantiza que no se inventan a posteriori.'
      },
      {
        q: '¿Qué garantiza FYB en cuanto a transparencia?',
        a: 'En FYB, cada pick queda registrado con su timestamp exacto. Esto impide que los tipsters publiquen picks "a posteriori" — es decir, que anuncien picks ganados que en realidad no registraron antes del partido. El historial es público, verificable y no se puede editar una vez resuelto.'
      },
    ]
  },
  {
    category: 'Cómo elegir un tipster',
    icon: 'trophy',
    items: [
      {
        q: '¿Cómo encontrar al mejor tipster para mí?',
        a: 'Sigue estos criterios: (1) Yield positivo sostenido durante al menos 3 meses. (2) Número de picks alto — a más picks, más significativo es el Yield estadísticamente. (3) Cuota media acorde a tu tolerancia al riesgo. (4) Análisis detallados en sus picks: un buen tipster razona, no solo anuncia. (5) Picks en deportes y mercados que tú también entiendes.'
      },
      {
        q: '¿Cuántos picks necesita un tipster para ser fiable?',
        a: 'Como mínimo, 50–100 picks resueltos son necesarios para que el Yield empiece a ser estadísticamente relevante. Con menos de 30, los resultados pueden ser puro azar. Cuanto mayor sea el histórico, más confianza puedes depositar en el rendimiento mostrado.'
      },
      {
        q: '¿Debo seguir a un solo tipster o a varios?',
        a: 'Diversificar entre 2–4 tipsters con estilos distintos (deportes, cuotas, mercados) reduce la varianza global de tu bankroll. Evita seguir a demasiados a la vez, ya que pierdes el control sobre tus stakes totales. La clave es calidad sobre cantidad.'
      },
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
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>

      <div className="page-header">
        <h2>Preguntas frecuentes</h2>
        <p>Todo lo que necesitas saber sobre FindYourBet y el mundo de los tipsters.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {FAQS.map((section, si) => (
          <div key={si} style={{ background: 'var(--color-bg)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <AppIcon name={section.icon} size={18} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {section.category}
              </div>
            </div>
            {section.items.map((item, ii) => (
              <FaqItem key={ii} q={item.q} a={item.a} />
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px', padding: '16px 20px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-primary-border)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        ¿No encuentras lo que buscas? Escríbenos a{' '}
        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>fyourbet@gmail.com</span>
        {' '}y te respondemos en menos de 24h.
      </div>

    </motion.div>
  )
}
