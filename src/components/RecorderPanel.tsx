import { useEffect, useMemo } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { useTranscription } from '../hooks/useTranscription'

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface Props {
  onSave: (params: { blob: Blob; mimeType: string; durationMs: number; transcript: string }) => Promise<void>
}

export function RecorderPanel({ onSave }: Props) {
  const recorder = useRecorder()
  const transcription = useTranscription()

  const recording = recorder.status === 'recording'
  const paused = recorder.status === 'paused'

  useEffect(() => {
    if (recorder.status === 'idle') transcription.reset()
  }, [recorder.status, transcription])

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
      await onSave({
        blob: result.blob,
        mimeType: result.mimeType,
        durationMs: recorder.elapsedMs,
        transcript,
      })
    } finally {
      transcription.reset()
    }
  }

  function handleCancel() {
    recorder.cancel()
    transcription.reset()
  }

  return (
    <section className="recorder">
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

      {(recording || paused) && (
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
    </section>
  )
}
