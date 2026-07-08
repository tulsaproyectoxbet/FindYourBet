import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import AppIcon from '../../components/ui/AppIcon'

// ── Upload ──────────────────────────────────────────────────────────────────

export async function uploadVoiceBlob(blob, userId) {
  const ext = blob.type.includes('ogg') ? 'ogg' : 'webm'
  const path = `voice/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('channel-files')
    .upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) return null
  const { data } = supabase.storage.from('channel-files').getPublicUrl(path)
  return data.publicUrl
}

// ── Waveform bars (DOM mutation, sense setState per evitar 60 re-renders/s) ──

const BAR_COUNT = 28

function WaveformBars({ analyserRef }) {
  const containerRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const draw = () => {
      const analyser = analyserRef.current
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const usable = Math.floor(data.length * 0.65)
        const step = usable / BAR_COUNT
        const els = container.children
        for (let i = 0; i < BAR_COUNT && i < els.length; i++) {
          const v = data[Math.floor(i * step)] / 255
          els[i].style.height = `${Math.max(3, Math.round(v * 28))}px`
          els[i].style.opacity = `${(0.3 + v * 0.7).toFixed(2)}`
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '28px', flex: 1 }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div key={i} style={{ width: '3px', height: '3px', background: 'var(--color-error)', borderRadius: '999px', flexShrink: 0, transition: 'height 0.05s ease' }} />
      ))}
    </div>
  )
}

// ── Waveform player ──────────────────────────────────────────────────────────

const PLAYER_BARS = 40

// Extreu l'amplitud real de l'àudio: N valors normalitzats 0–1
async function decodeWaveform(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    const buf = await res.arrayBuffer()
    const ctx = new AudioContext()
    const audio = await ctx.decodeAudioData(buf)
    ctx.close()
    const raw = audio.getChannelData(0)
    const block = Math.floor(raw.length / PLAYER_BARS)
    const bars = Array.from({ length: PLAYER_BARS }, (_, i) => {
      let peak = 0
      for (let j = 0; j < block; j++) peak = Math.max(peak, Math.abs(raw[i * block + j]))
      return peak
    })
    const max = Math.max(...bars, 0.001)
    return bars.map(b => b / max)
  } catch {
    // Fallback: barres amb alçada neutra si el fetch falla (ex. CORS)
    return Array.from({ length: PLAYER_BARS }, (_, i) =>
      0.25 + 0.5 * Math.abs(Math.sin(i * 0.7))
    )
  }
}

// ── Player ──────────────────────────────────────────────────────────────────

export function VoicePlayer({ url, isOwn }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [waveform, setWaveform] = useState([])
  const audioRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    decodeWaveform(url).then(bars => { if (!cancelled) setWaveform(bars) })
    return () => { cancelled = true }
  }, [url])

  const fmtTime = s => {
    if (!isFinite(s) || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const handleSeek = e => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const progress = duration ? currentTime / duration : 0
  const fillColor = isOwn ? 'rgba(0,0,0,0.75)' : 'var(--color-primary)'
  const trackBg   = isOwn ? 'rgba(0,0,0,0.18)' : 'var(--color-border)'
  const btnBg     = isOwn ? '#010906' : 'var(--color-primary)'
  const btnTxt    = isOwn ? 'var(--color-primary)' : '#010906'
  const mutedClr  = isOwn ? 'rgba(0,0,0,0.45)' : 'var(--color-text-muted)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px', maxWidth: '260px' }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={e => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }} />
      <button onClick={toggle}
        style={{ width: '34px', height: '34px', borderRadius: '50%', background: btnBg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0, color: btnTxt }}>
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {/* Waveform bars */}
        <div onClick={handleSeek}
          style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '28px', cursor: 'pointer' }}>
          {(waveform.length ? waveform : Array(PLAYER_BARS).fill(0.35)).map((h, i) => {
            const played = i / PLAYER_BARS < progress
            return (
              <div key={i} style={{
                width: '3px',
                height: `${Math.max(3, Math.round(h * 26))}px`,
                background: played ? fillColor : trackBg,
                borderRadius: '999px',
                flexShrink: 0,
                transition: 'background 0.05s',
              }} />
            )
          })}
        </div>
        <div style={{ fontSize: '10px', color: mutedClr, fontVariantNumeric: 'tabular-nums' }}>
          {fmtTime(playing ? currentTime : duration)}
        </div>
      </div>
    </div>
  )
}

// ── Botó de gravació ────────────────────────────────────────────────────────

export function VoiceRecordButton({ onSend, userId }) {
  const { t } = useTranslation()
  const [state, setState] = useState('idle') // idle | recording | uploading
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const mrRef       = useRef(null)
  const chunksRef   = useRef([])
  const timerRef    = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    cancelAudioCtx()
    try { mrRef.current?.stream?.getTracks().forEach(t => t.stop()) } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const cancelAudioCtx = () => {
    analyserRef.current = null
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
  }

  const startRecording = async () => {
    setError('')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(t('voice.noMic'))
      return
    }

    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.75
      ctx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
    } catch {}

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    const mr = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []
    mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    mr.start()
    mrRef.current = mr
    setState('recording')
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }

  const cancelRecording = () => {
    clearInterval(timerRef.current)
    cancelAudioCtx()
    try {
      mrRef.current?.stream?.getTracks().forEach(t => t.stop())
      if (mrRef.current?.state !== 'inactive') mrRef.current.stop()
    } catch {}
    mrRef.current = null
    setState('idle')
    setSeconds(0)
    setError('')
  }

  const sendRecording = async () => {
    clearInterval(timerRef.current)
    cancelAudioCtx()
    setState('uploading')

    try {
      const blob = await new Promise((resolve) => {
        const mr = mrRef.current
        if (!mr || mr.state === 'inactive') { resolve(null); return }

        const timeout = setTimeout(() => resolve(null), 6000)

        mr.onstop = () => {
          clearTimeout(timeout)
          const b = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
          try { mr.stream.getTracks().forEach(t => t.stop()) } catch {}
          resolve(b)
        }
        mr.stop()
      })

      if (!blob || blob.size === 0) {
        setError(t('voice.noAudio'))
        setState('idle')
        return
      }

      const url = await uploadVoiceBlob(blob, userId)
      if (!url) {
        setError(t('voice.uploadError'))
        setState('idle')
        return
      }

      await onSend(`[VOICE]:${url}`)
    } catch {
      setError(t('voice.errorSending'))
    } finally {
      mrRef.current = null
      setState('idle')
      setSeconds(0)
    }
  }

  if (state === 'uploading') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', background: 'var(--color-bg-soft)', border: '0.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
      <AppIcon name="loading" size={13} /> {t('voice.sending')}
    </div>
  )

  if (state === 'recording') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '10px 14px', background: 'var(--color-error-light)', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-error)', display: 'inline-block', flexShrink: 0, animation: 'voicePulse 1s ease-in-out infinite' }} />
      <WaveformBars analyserRef={analyserRef} />
      <span style={{ fontSize: '12px', color: 'var(--color-error)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {fmtSec(seconds)}
      </span>
      <button onClick={cancelRecording}
        style={{ background: 'none', border: '0.5px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--color-error)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
        {t('common.cancel')}
      </button>
      <button onClick={sendRecording}
        style={{ background: 'var(--color-error)', border: 'none', borderRadius: 'var(--radius-md)', padding: '4px 12px', cursor: 'pointer', fontSize: '12px', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
        <AppIcon name="check" size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> {t('common.send')}
      </button>
    </div>
  )

  return (
    <button onClick={startRecording} title={error || t('voice.title')}
      style={{ background: error ? 'var(--color-error-light)' : 'var(--color-bg)', border: `0.5px solid ${error ? 'var(--color-error-border)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', padding: '11px 14px', cursor: 'pointer', color: error ? 'var(--color-error)' : 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      <AppIcon name="mic" size={16} />
    </button>
  )
}
