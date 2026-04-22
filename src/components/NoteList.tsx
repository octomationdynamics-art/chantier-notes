import { useMemo, useState } from 'react'
import type { Note } from '../types'
import { NoteItem } from './NoteItem'

interface Props {
  notes: Note[]
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

function matchesQuery(note: Note, q: string): boolean {
  if (!q) return true
  const t = q.toLowerCase()
  if (note.name.toLowerCase().includes(t)) return true
  if (note.transcript.toLowerCase().includes(t)) return true
  if ((note.chantier ?? '').toLowerCase().includes(t)) return true
  if (note.tags.some((x) => x.toLowerCase().includes(t))) return true
  return false
}

export function NoteList({
  notes,
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
  const [query, setQuery] = useState('')
  const [chantierFilter, setChantierFilter] = useState<string>('')

  const chantierOptions = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) if (n.chantier) set.add(n.chantier)
    return Array.from(set).sort()
  }, [notes])

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (chantierFilter && n.chantier !== chantierFilter) return false
      if (!matchesQuery(n, query)) return false
      return true
    })
  }, [notes, query, chantierFilter])

  const hasNotes = notes.length > 0

  return (
    <>
      {hasNotes && (
        <div className="notes-toolbar">
          <input
            className="search-input"
            type="search"
            placeholder="Rechercher dans les notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {chantierOptions.length > 0 && (
            <select
              className="search-select"
              value={chantierFilter}
              onChange={(e) => setChantierFilter(e.target.value)}
            >
              <option value="">Tous chantiers</option>
              {chantierOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="empty">
          <p>Pas encore d'enregistrement.</p>
          <p className="muted">Appuie sur le bouton pour dicter ta première note de chantier.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>Aucune note ne correspond à la recherche.</p>
        </div>
      ) : (
        <div className="note-list">
          {filtered.map((n) => (
            <NoteItem
              key={n.id}
              note={n}
              chantierSuggestions={chantierSuggestions}
              tagSuggestions={tagSuggestions}
              onRename={onRename}
              onDelete={onDelete}
              onSync={onSync}
              onChangeChantier={onChangeChantier}
              onChangeTags={onChangeTags}
              onAddPhotos={onAddPhotos}
              onDeletePhoto={onDeletePhoto}
            />
          ))}
        </div>
      )}
    </>
  )
}
