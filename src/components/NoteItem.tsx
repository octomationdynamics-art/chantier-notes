import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note, Photo } from '../types'
import { ChantierPicker } from './ChantierPicker'
import { TagChips } from './TagChips'
import { PhotoStrip } from './PhotoStrip'

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
  chantierSuggestions: string[]
  tagSuggestions: string[]
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSync: (id: string) => Promise<void>
  onChangeChantier: (id: string, chantier: string) => Promise<void>
  onChangeTags: (id: string, tags: string[]) => Promise<void>
  onAddPhotos: (id: string, files: File[]) => Promise<void>
  onDeletePhoto: (id: string, photoId: string) => Promise<void>
}

export function NoteItem({
  note,
  chantierSuggestions,
  tagSuggestions,
  onRename,
  onDelete,
  onSync,
  onChangeChantier,
  onChangeTags,
  onAddPhotos,
  onDeletePhoto,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(note.name)
  const [editingMeta, setEditingMeta] = useState(false)
  const [chantier, setChantier] = useState(note.chantier ?? '')
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setName(note.name), [note.name])
  useEffect(() => setChantier(note.chantier ?? ''), [note.chantier])

  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  const audioUrl = useMemo(() => URL.createObjectURL(note.audioBlob), [note.audioBlob])
  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])

  async function commitRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === note.name) {
      setName(note.name)
      setEditingName(false)
      return
    }
    await onRename(note.id, trimmed)
    setEditingName(false)
  }

  async function commitChantier() {
    const trimmed = chantier.trim()
    if (trimmed !== (note.chantier ?? '')) {
      await onChangeChantier(note.id, trimmed)
    }
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

  const handleTagsChange = (tags: string[]) => onChangeTags(note.id, tags)
  const handleAddPhotos = (files: File[]) => onAddPhotos(note.id, files)
  const handleDeletePhoto = (photoId: string) => onDeletePhoto(note.id, photoId)

  const photoDisplay: Photo[] = note.photos

  return (
    <article className={`note-item sync-${note.syncState}`}>
      <header className="note-head">
        {editingName ? (
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
                setEditingName(false)
              }
            }}
            aria-label="Nom de la note"
          />
        ) : (
          <button className="note-name" onClick={() => setEditingName(true)} title="Renommer">
            {note.name}
          </button>
        )}
        <span className={`sync-badge sync-${note.syncState}`}>{statusLabel[note.syncState]}</span>
      </header>

      <div className="note-meta">
        <span>{formatDate(note.createdAt)}</span>
        <span> · </span>
        <span>{formatDuration(note.durationMs)}</span>
        {note.chantier && (
          <>
            <span> · </span>
            <span className="note-chantier">🏗 {note.chantier}</span>
          </>
        )}
      </div>

      {note.tags.length > 0 && (
        <div className="note-tag-display">
          {note.tags.map((t) => (
            <span key={t} className="tag-chip static">{t}</span>
          ))}
        </div>
      )}

      {note.syncError && <p className="error">{note.syncError}</p>}

      <audio controls src={audioUrl} className="note-audio" preload="metadata" />

      <PhotoStrip photos={photoDisplay} onAdd={handleAddPhotos} onDelete={handleDeletePhoto} />

      <div className="note-actions">
        <button className="btn-ghost btn-small" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Masquer' : 'Voir'} le texte
        </button>
        <button className="btn-ghost btn-small" onClick={() => setEditingMeta((v) => !v)}>
          {editingMeta ? 'Fermer' : '✎ Chantier/tags'}
        </button>
        {note.syncState !== 'uploading' && (
          <button className="btn-ghost btn-small" onClick={() => onSync(note.id)}>
            {note.syncState === 'synced' ? 'Renvoyer' : 'Envoyer vers Drive'}
          </button>
        )}
        {note.driveAudioUrl && (
          <a className="btn-link btn-small" href={note.driveAudioUrl} target="_blank" rel="noreferrer">
            🔊 Audio
          </a>
        )}
        {note.driveTranscriptUrl && (
          <a className="btn-link btn-small" href={note.driveTranscriptUrl} target="_blank" rel="noreferrer">
            📝 Texte
          </a>
        )}
        {note.driveFolderUrl && (
          <a className="btn-link btn-small" href={note.driveFolderUrl} target="_blank" rel="noreferrer">
            📁 Dossier
          </a>
        )}
        {note.driveShareUrl && (
          <button
            className="btn-ghost btn-small"
            onClick={() => navigator.clipboard?.writeText(note.driveShareUrl ?? '')}
          >
            🔗 Lien
          </button>
        )}
        <button className="btn-danger btn-small" onClick={handleDelete}>
          🗑
        </button>
      </div>

      {editingMeta && (
        <div className="note-edit-meta">
          <ChantierPicker
            value={chantier}
            onChange={setChantier}
            suggestions={chantierSuggestions}
          />
          <button type="button" className="btn-primary btn-small" onClick={commitChantier}>
            Enregistrer chantier
          </button>
          <TagChips value={note.tags} onChange={handleTagsChange} extraSuggestions={tagSuggestions} />
        </div>
      )}

      {expanded && (
        <pre className="note-transcript">
          {note.transcript || '(transcription vide)'}
        </pre>
      )}
    </article>
  )
}
