const PICKS_BASE = 'https://slfgvgvguwavvbkpsngf.supabase.co/storage/v1/object/public/channel-files/picks'

// Avatar estàtic de la "casa" (perdedora) — s'usa en tots els templates.
export const BOOKIE_AVATAR = `${PICKS_BASE}/casa.png`

// Coordenades en píxels de la imatge original. winner/loser = { x, y, r } (centre + radi).
// r gran intencionadament: l'avatar és el protagonista de la imatge.
export const WINNER_TEMPLATES = [
  {
    id: 'esports', src: `${PICKS_BASE}/esports.png`, label: 'Esports',
    imgW: 1672, imgH: 941,
    winner: { x: 368, y: 248, r: 160 },
    loser:  { x: 1118, y: 355, r: 120 },
  },
  {
    id: 'futbol', src: `${PICKS_BASE}/futbol.png`, label: 'Fútbol',
    imgW: 1672, imgH: 941,
    winner: { x: 295, y: 168, r: 140 },
    loser:  { x: 1055, y: 288, r: 115 },
  },
  {
    id: 'basket', src: `${PICKS_BASE}/basket.png`, label: 'Basket',
    imgW: 1672, imgH: 941,
    winner: { x: 445, y: 348, r: 160 },
    loser:  { x: 1318, y: 452, r: 120 },
  },
  {
    id: 'boxeo', src: `${PICKS_BASE}/boxeo.png`, label: 'Boxeo',
    imgW: 1672, imgH: 941,
    winner: { x: 332, y: 215, r: 155 },
    loser:  { x: 1271, y: 254, r: 130 },
  },
  {
    id: 'poker', src: `${PICKS_BASE}/poker.png`, label: 'Póker',
    imgW: 1672, imgH: 941,
    winner: { x: 448, y: 198, r: 160 },
    loser:  { x: 1204, y: 226, r: 120 },
  },
  {
    id: 'f1', src: `${PICKS_BASE}/f1.png`, label: 'F1',
    imgW: 1672, imgH: 941,
    winner: { x: 1055, y: 420, r: 100 },
    loser:  { x: 558, y: 430, r: 90 },
  },
]
