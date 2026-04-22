import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../types'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  note: Note
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSync: (id: string) => Promise<void>
}

export function NoteItem({ note, onRename, onDelete, onSync }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(note.name)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(note.name)
  }, [note.name])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const audioUrl = useMemo(() => URL.createObjectURL(note.audioBlob), [note.audioBlob])
  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])

  async function commitRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === note.name) {
      setName(note.name)
      setEditing(false)
      return
    }
    await onRename(note.id, trimmed)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer « ${note.name} » ?`)) return
    await onDelete(note.id)
  }

  const statusLabel: Record<typeof note.syncState, string> = {
    local: 'Local',
    uploading: 'Envoi…',
    synced: 'Sur Drive',
    error: 'Erreur',
  }

  return (
    <article className={`note-item sync-${note.syncState}`}>
      <header className="note-head">
        {editing ? (
          <input
            ref={inputRef}
            className="note-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setName(note.name)
                setEditing(false)
              }
            }}
            aria-label="Nom de la note"
          />
        ) : (
          <button className="note-name" onClick={() => setEditing(true)} title="Renommer">
            {note.name}
          </button>
        )}
        <span className={`sync-badge sync-${note.syncState}`}>{statusLabel[note.syncState]}</span>
      </header>

      <div className="note-meta">
        <span>{formatDate(note.createdAt)}</span>
        <span> · </span>
        <span>{formatDuration(note.durationMs)}</span>
      </div>

      {note.syncError && <p className="error">{note.syncError}</p>}

      <audio controls src={audioUrl} className="note-audio" preload="metadata" />

      <div className="note-actions">
        <button className="btn-ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Masquer' : 'Voir'} le texte
        </button>
        {note.syncState !== 'uploading' && (
          <button className="btn-ghost" onClick={() => onSync(note.id)}>
            {note.syncState === 'synced' ? 'Renvoyer' : 'Envoyer vers Drive'}
          </button>
        )}
        {note.driveAudioUrl && (
          <a className="btn-link" href={note.driveAudioUrl} target="_blank" rel="noreferrer">
            🔊 Audio
          </a>
        )}
        {note.driveTranscriptUrl && (
          <a className="btn-link" href={note.driveTranscriptUrl} target="_blank" rel="noreferrer">
            📝 Texte
          </a>
        )}
        {note.driveFolderUrl && (
          <a className="btn-link" href={note.driveFolderUrl} target="_blank" rel="noreferrer">
            📁 Dossier
          </a>
        )}
        {note.driveShareUrl && (
          <button
            className="btn-ghost"
            onClick={() => navigator.clipboard?.writeText(note.driveShareUrl ?? '')}
          >
            🔗 Copier lien partage
          </button>
        )}
        <button className="btn-danger" onClick={handleDelete}>
          🗑 Supprimer
        </button>
      </div>

      {expanded && (
        <pre className="note-transcript">
          {note.transcript || '(transcription vide)'}
        </pre>
      )}
    </article>
  )
}
