import { WINNER_TEMPLATES, BOOKIE_AVATAR } from '../../../lib/winnerTemplates'
import Avatar from '../../../components/ui/Avatar'

// Renderitza la plantilla de victòria amb avatar del tipster i imatge de la casa,
// posicionats sobre les cares dels personatges via CSS absolut.
export default function WinnerCard({ tpl: tplId, avatar }) {
  const tpl = WINNER_TEMPLATES.find(t => t.id === tplId)
  if (!tpl) return null

  const { winner: w, loser: l, imgW, imgH } = tpl

  // Converteix píxels originals a % de la imatge — funciona a qualsevol mida de display.
  const px = (v) => `${(v / imgW * 100).toFixed(3)}%`
  const py = (v) => `${(v / imgH * 100).toFixed(3)}%`

  const circleStyle = (pos) => ({
    position: 'absolute',
    left: px(pos.x - pos.r),
    top: py(pos.y - pos.r),
    width: px(pos.r * 2),
    aspectRatio: '1',
    borderRadius: '50%',
    overflow: 'hidden',
  })

  return (
    <div style={{
      position: 'relative',
      display: 'block',
      width: '100%',
      lineHeight: 0,
      containerType: 'inline-size',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <img src={tpl.src} alt={tpl.label} style={{ width: '100%', display: 'block' }} draggable={false} />

      {/* Cercle guanyador — avatar del tipster sobre la cara del personatge */}
      <div style={circleStyle(w)}>
        {avatar
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Avatar username="?" size={w.r * 2} />
        }
      </div>

      {/* Cercle perdedor — avatar de la casa sobre la cara del perdedor */}
      <div style={circleStyle(l)}>
        <img src={BOOKIE_AVATAR} alt="Casa" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    </div>
  )
}
