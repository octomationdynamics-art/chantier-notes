import type { Note } from '../types'
import { NoteItem } from './NoteItem'

interface Props {
  notes: Note[]
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSync: (id: string) => Promise<void>
}

export function NoteList({ notes, onRename, onDelete, onSync }: Props) {
  if (notes.length === 0) {
    return (
      <div className="empty">
        <p>Pas encore d'enregistrement.</p>
        <p className="muted">Appuie sur le bouton pour dicter ta première note de chantier.</p>
      </div>
    )
  }
  return (
    <div className="note-list">
      {notes.map((n) => (
        <NoteItem key={n.id} note={n} onRename={onRename} onDelete={onDelete} onSync={onSync} />
      ))}
    </div>
  )
}
