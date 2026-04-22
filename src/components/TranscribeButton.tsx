import { useState } from 'react'
import { transcribeBlob, type WhisperProgress } from '../stt/whisper'

interface Props {
  audioBlob: Blob
  onDone: (text: string) => void | Promise<void>
  compact?: boolean
}

function formatProgress(p: WhisperProgress): string {
  switch (p.status) {
    case 'importing library':
      return 'Chargement bibliothèque…'
    case 'loading model':
    case 'initiate':
      return `Modèle ${p.file ?? ''} …`
    case 'download':
    case 'progress':
      if (typeof p.progress === 'number') {
        const pct = Math.round(p.progress)
        const mb = p.loaded ? ` (${(p.loaded / 1024 / 1024).toFixed(1)} Mo)` : ''
        return `Téléchargement ${pct}%${mb}`
      }
      return `Téléchargement ${p.file ?? ''} …`
    case 'done':
    case 'ready':
      return 'Prêt'
    case 'decoding audio':
      return 'Décodage audio…'
    case 'transcribing':
      return 'Transcription en cours…'
    default:
      return p.status
  }
}

export function TranscribeButton({ audioBlob, onDone, compact = false }: Props) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<WhisperProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    if (running) return
    setRunning(true)
    setError(null)
    setProgress({ status: 'importing library' })
    try {
      const text = await transcribeBlob(audioBlob, (p) => setProgress(p))
      if (!text) {
        setError('Transcription vide (audio silencieux ?)')
      } else {
        await onDone(text)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="transcribe-wrap">
      <button
        className={`btn-primary ${compact ? 'btn-small' : ''}`}
        onClick={handle}
        disabled={running}
      >
        {running ? '⏳ Transcription…' : '🤖 Transcrire (Whisper)'}
      </button>
      {progress && running && (
        <div className="transcribe-progress">
          <div className="transcribe-status">{formatProgress(progress)}</div>
          {typeof progress.progress === 'number' && progress.progress > 0 && progress.progress < 100 && (
            <div className="transcribe-bar">
              <div
                className="transcribe-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
              />
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
