export default function handler(req, res) {
  return res.status(503).json({ error: 'Payments temporarily disabled' })
}
