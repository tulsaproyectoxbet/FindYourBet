export function formatMsgPreview(content) {
  if (!content) return ''
  if (content === '[DELETED]') return ''
  const inner = content
    .replace(/^\[FWD[^\]]*\]:/, '')
    .replace(/^\[REPLY:[^\]]*\]:/, '')
    .replace(/\[EDITED\]$/, '')
    .trim()
  if (inner.startsWith('[WINNER]:'))  return '🏆 Victoria'
  if (inner.startsWith('[IMAGE]:'))   return '📷 Imagen'
  if (inner.startsWith('[IMG_MSG]:')) {
    try { const d = JSON.parse(inner.replace('[IMG_MSG]:', '')); return '📷 ' + (d.text || 'Imagen') } catch { return '📷 Imagen' }
  }
  if (inner.startsWith('[FILE:'))     return '📎 Archivo'
  if (inner.startsWith('[VOICE]:'))   return '🎙 Mensaje de voz'
  if (inner.startsWith('[GIF]:'))     return '🎬 GIF'
  if (inner.startsWith('[STICKER]:')) return '🎭 Sticker'
  if (inner.startsWith('[PROFILE]:')) return '👤 Perfil compartido'
  if (inner.startsWith('[CHANNEL]:')) return '📢 Canal compartido'
  if (inner.startsWith('[BET]:'))     return '🎯 Pick'
  if (inner.startsWith('[POLL]:'))    return '📊 Encuesta'
  return inner.slice(0, 60)
}
