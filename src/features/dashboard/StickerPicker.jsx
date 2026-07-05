import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import AppIcon from '../../components/ui/AppIcon'

const PACKS = {
  '🔥': ['🔥','💥','⚡','✨','🚀','💪','🙌','🤩','🥳','🎊','🎉','💯','😎','🫶','❤️','💚'],
  '⚽': ['⚽','🏆','🥇','🎯','🏅','🥊','🏋️','🤾','🧤','🏀','🎾','🏈','🏒','⛷️','🎽','🥋'],
  '💰': ['💸','💰','🤑','📈','📉','✅','❌','🎰','🎲','🃏','🤞','💎','🤝','📊','💹','🏦'],
  '😂': ['😭','😤','🤯','🥶','😏','🙄','😬','🤦','🤷','👀','💀','🫡','😅','🥲','😳','🫠'],
}

export function StickerPicker({ onSelect, onSendGif, onClose, user }) {
  const [mainTab, setMainTab] = useState('emoji')
  const [activeEmojiTab, setActiveEmojiTab] = useState(Object.keys(PACKS)[0])
  const [gifs, setGifs] = useState([])
  const [myGifs, setMyGifs] = useState([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [loadingMyGifs, setLoadingMyGifs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const uploadRef = useRef(null)

  useEffect(() => {
    if (mainTab === 'gif') fetchGifs()
  }, [mainTab])

  useEffect(() => {
    if (mainTab === 'mygif') fetchMyGifs()
  }, [mainTab])

  const fetchGifs = async () => {
    setLoadingGifs(true)
    try {
      const { data } = await supabase.storage.from('gifs').list('', { limit: 50 })
      const urls = (data || [])
        .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
        .map(f => {
          const { data: u } = supabase.storage.from('gifs').getPublicUrl(f.name)
          return u.publicUrl
        })
      setGifs(urls)
    } catch {
      setGifs([])
    } finally {
      setLoadingGifs(false)
    }
  }

  const fetchMyGifs = async () => {
    if (!user?.id) return
    setLoadingMyGifs(true)
    try {
      const { data } = await supabase
        .from('user_stickers')
        .select('url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setMyGifs((data || []).map(r => r.url))
    } catch {
      setMyGifs([])
    } finally {
      setLoadingMyGifs(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'image/gif' && !file.name.toLowerCase().endsWith('.gif')) {
      setUploadError('Solo se aceptan archivos .gif')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('El GIF debe pesar menos de 2 MB (≈ 2 segundos)')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const path = `${user.id}/${Date.now()}.gif`
      const { error: upErr } = await supabase.storage
        .from('user-stickers')
        .upload(path, file, { upsert: false })
      if (upErr) { setUploadError(`Error: ${upErr.message}`); return }
      const { data: urlData } = supabase.storage.from('user-stickers').getPublicUrl(path)
      await supabase.from('user_stickers').insert({ user_id: user.id, url: urlData.publicUrl })
      await fetchMyGifs()
    } catch {
      setUploadError('Error inesperado')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
          background: 'var(--color-bg)', border: '0.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
          zIndex: 20, width: '312px', overflow: 'hidden',
        }}
      >
        {/* TABS PRINCIPALS */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border)' }}>
          {[['emoji', 'Emoji'], ['gif', 'GIF'], ['mygif', 'Mis GIFs']].map(([id, label]) => (
            <button key={id} onClick={() => setMainTab(id)}
              style={{
                flex: 1, border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700, padding: '10px 4px',
                color: mainTab === id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: mainTab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
                transition: 'color 0.15s', fontFamily: 'var(--font-sans)',
              }}
            >{label}</button>
          ))}
          <button onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '10px 12px', color: 'var(--color-text-muted)', lineHeight: 1, flexShrink: 0, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
          ><AppIcon name="close" size={14} /></button>
        </div>

        {/* TAB EMOJI */}
        {mainTab === 'emoji' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5px solid var(--color-border)', padding: '0 4px' }}>
              {Object.keys(PACKS).map(tab => (
                <button key={tab} onClick={() => setActiveEmojiTab(tab)}
                  style={{
                    flex: 1, border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '18px', padding: '7px 4px',
                    borderBottom: activeEmojiTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    opacity: activeEmojiTab === tab ? 1 : 0.45, transition: 'opacity 0.15s',
                  }}
                >{tab}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', padding: '8px' }}>
              {PACKS[activeEmojiTab].map((s, i) => (
                <button key={i} onClick={() => onSelect(s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '6px', borderRadius: 'var(--radius-sm)', lineHeight: 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-soft)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >{s}</button>
              ))}
            </div>
          </>
        )}

        {/* TAB GIF (curats per admin) */}
        {mainTab === 'gif' && (
          <div style={{ height: '240px', overflowY: 'auto', padding: '8px' }}>
            {loadingGifs ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 0', fontSize: '13px' }}>Cargando GIFs...</div>
            ) : gifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '60px 0', fontSize: '13px' }}>No hay GIFs disponibles aún</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {gifs.map((url, i) => (
                  <button key={i} onClick={() => { onSendGif?.(url); onClose() }}
                    style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', padding: 0, aspectRatio: '16/9' }}>
                    <img src={url} alt="gif" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB MIS GIFs (pujats per l'usuari) */}
        {mainTab === 'mygif' && (
          <div style={{ height: '280px', overflowY: 'auto', padding: '8px' }}>
            <input ref={uploadRef} type="file" accept="image/gif,.gif" onChange={handleUpload} style={{ display: 'none' }} />
            {uploadError && (
              <div style={{ fontSize: '11px', color: 'var(--color-error)', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginBottom: '8px' }}>
                {uploadError}
              </div>
            )}
            <button onClick={() => uploadRef.current?.click()} disabled={uploading}
              style={{ width: '100%', padding: '9px', border: '0.5px dashed var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-soft)', color: uploading ? 'var(--color-text-muted)' : 'var(--color-primary)', cursor: uploading ? 'default' : 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', marginBottom: '10px' }}>
              {uploading ? <><AppIcon name="loading" size={12} style={{ marginRight:4, verticalAlign:'middle' }} /> Subiendo...</> : '+ Subir GIF (máx. 2 MB)'}
            </button>
            {loadingMyGifs ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: '13px' }}>Cargando...</div>
            ) : myGifs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: '13px' }}>Aún no tienes GIFs guardados</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {myGifs.map((url, i) => (
                  <button key={i} onClick={() => { onSendGif?.(url); onClose() }}
                    style={{ background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', padding: 0, aspectRatio: '16/9' }}>
                    <img src={url} alt="my gif" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  )
}
