import { useEffect, useMemo, useState } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useTranscription } from '../hooks/useTranscription'
import { ChantierPicker } from './ChantierPicker'
import { TagChips } from './TagChips'
import { PhotoStrip } from './PhotoStrip'
import type { Photo } from '../types'

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function generatePhotoId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

interface Props {
  chantierSuggestions: string[]
  tagSuggestions: string[]
  defaultChantier?: string
  onChangeDefaultChantier?: (v: string) => void
  onSave: (params: {
    blob: Blob
    mimeType: string
    durationMs: number
    transcript: string
    chantier?: string
    tags: string[]
    photos: Photo[]
  }) => Promise<void>
}

export function RecorderPanel({
  chantierSuggestions,
  tagSuggestions,
  defaultChantier = '',
  onChangeDefaultChantier,
  onSave,
}: Props) {
  const recorder = useRecorder()
  const transcription = useTranscription()
  const [chantier, setChantier] = useState(defaultChantier)
  const [tags, setTags] = useState<string[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])

  const recording = recorder.status === 'recording'
  const paused = recorder.status === 'paused'
  const active = recording || paused

  useEffect(() => {
    if (recorder.status === 'idle') {
      transcription.reset()
    }
  }, [recorder.status, transcription])

  useEffect(() => {
    setChantier(defaultChantier)
  }, [defaultChantier])

  const liveText = useMemo(() => {
    const final = transcription.finalText
    const interim = transcription.interimText
    if (final && interim) return `${final} ${interim}`
    return final || interim
  }, [transcription.finalText, transcription.interimText])

  async function handleStart() {
    await recorder.start()
    if (transcription.supported) transcription.start()
  }

  function handlePause() {
    recorder.pause()
    transcription.pause()
  }

  function handleResume() {
    recorder.resume()
    if (transcription.supported) transcription.resume()
  }

  async function handleStop() {
    const transcript = transcription.stop()
    try {
      const result = await recorder.stop()
      const effectiveChantier = chantier.trim() || undefined
      await onSave({
        blob: result.blob,
        mimeType: result.mimeType,
        durationMs: recorder.elapsedMs,
        transcript,
        chantier: effectiveChantier,
        tags,
        photos,
      })
      if (effectiveChantier && onChangeDefaultChantier) onChangeDefaultChantier(effectiveChantier)
      setTags([])
      setPhotos([])
    } finally {
      transcription.reset()
    }
  }

  function handleCancel() {
    recorder.cancel()
    transcription.reset()
    setPhotos([])
    setTags([])
  }

  function handleAddPhotos(files: File[]) {
    const newPhotos: Photo[] = files.map((f) => ({
      id: generatePhotoId(),
      blob: f,
      mime: f.type,
      syncState: 'local',
    }))
    setPhotos((prev) => [...prev, ...newPhotos])
  }

  function handleDeletePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <section className="recorder">
      <div className="recorder-form">
        <ChantierPicker value={chantier} onChange={setChantier} suggestions={chantierSuggestions} />
        <TagChips value={tags} onChange={setTags} extraSuggestions={tagSuggestions} />
      </div>

      <div className={`timer ${recording ? 'pulse' : ''}`}>
        {formatDuration(recorder.elapsedMs)}
        {paused && <span className="paused-tag">EN PAUSE</span>}
      </div>

      {recorder.status === 'idle' || recorder.status === 'stopped' ? (
        <button className="btn-record" onClick={handleStart} aria-label="Démarrer l'enregistrement">
          <span className="dot" /> Enregistrer
        </button>
      ) : (
        <div className="recorder-actions">
          {recording ? (
            <button className="btn-pause" onClick={handlePause}>⏸ Pause</button>
          ) : (
            <button className="btn-primary" onClick={handleResume}>▶ Reprendre</button>
          )}
          <button className="btn-stop" onClick={handleStop}>⏹ Terminer</button>
          <button className="btn-ghost" onClick={handleCancel}>Annuler</button>
        </div>
      )}

      {recorder.error && <p className="error">{recorder.error}</p>}

      {active && (
        <div className="transcript-live">
          <h3>Transcription en direct</h3>
          {transcription.supported ? (
            <p className="transcript-text">{liveText || <span className="muted">Parlez…</span>}</p>
          ) : (
            <p className="muted">Reconnaissance vocale non supportée sur ce navigateur.</p>
          )}
          {transcription.error && <p className="error">{transcription.error}</p>}
        </div>
      )}

      {active && (
        <PhotoStrip photos={photos} onAdd={handleAddPhotos} onDelete={handleDeletePhoto} label="Photos à joindre" />
      )}
    </section>
  )
}
