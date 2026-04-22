import { useCallback, useEffect, useState } from 'react'
import { LoginBar } from './components/LoginBar'
import { RecorderPanel } from './components/RecorderPanel'
import { NoteList } from './components/NoteList'
import { deleteNote, listNotes, saveNote, updateNote } from './db/notes'
import { deleteNoteFiles, uploadNote } from './drive/googledrive'
import { getStoredUser } from './auth/google'
import type { Note } from './types'
import { isConfigured } from './config'
import './App.css'

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultName(createdAt: number): string {
  const d = new Date(createdAt)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `Note ${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])

  const reload = useCallback(async () => {
    const all = await listNotes()
    setNotes(all)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const trySync = useCallback(async (note: Note): Promise<Note> => {
    if (!isConfigured() || !getStoredUser()) return note
    const uploading: Note = { ...note, syncState: 'uploading', syncError: undefined }
    await saveNote(uploading)
    setNotes((prev) => prev.map((n) => (n.id === note.id ? uploading : n)))
    try {
      const result = await uploadNote({
        baseName: note.name,
        audioBlob: note.audioBlob,
        transcript: note.transcript,
      })
      const synced: Note = {
        ...uploading,
        syncState: 'synced',
        driveFolderUrl: result.folderWebUrl,
        driveAudioUrl: result.audioWebUrl,
        driveTranscriptUrl: result.transcriptWebUrl,
        driveShareUrl: result.shareUrl,
        syncError: undefined,
      }
      await saveNote(synced)
      setNotes((prev) => prev.map((n) => (n.id === note.id ? synced : n)))
      return synced
    } catch (e) {
      const errored: Note = {
        ...uploading,
        syncState: 'error',
        syncError: e instanceof Error ? e.message : String(e),
      }
      await saveNote(errored)
      setNotes((prev) => prev.map((n) => (n.id === note.id ? errored : n)))
      return errored
    }
  }, [])

  const handleSave = useCallback(
    async (params: { blob: Blob; mimeType: string; durationMs: number; transcript: string }) => {
      const createdAt = Date.now()
      const note: Note = {
        id: generateId(),
        name: defaultName(createdAt),
        createdAt,
        durationMs: params.durationMs,
        audioMime: params.mimeType,
        audioBlob: params.blob,
        transcript: params.transcript,
        syncState: 'local',
      }
      await saveNote(note)
      setNotes((prev) => [note, ...prev])
      await trySync(note)
    },
    [trySync],
  )

  const handleRename = useCallback(
    async (id: string, name: string) => {
      const updated = await updateNote(id, { name })
      if (updated) {
        setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
        if (updated.syncState === 'synced' || updated.syncState === 'error') {
          await trySync(updated)
        }
      }
    },
    [trySync],
  )

  const handleDelete = useCallback(async (id: string) => {
    const target = notes.find((n) => n.id === id)
    await deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (target && target.syncState === 'synced' && isConfigured() && getStoredUser()) {
      try {
        await deleteNoteFiles(target.name)
      } catch {
        /* best effort */
      }
    }
  }, [notes])

  const handleManualSync = useCallback(
    async (id: string) => {
      const target = notes.find((n) => n.id === id)
      if (target) await trySync(target)
    },
    [notes, trySync],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏗️ Chantier Notes</h1>
        <LoginBar />
      </header>
      <main className="app-main">
        <RecorderPanel onSave={handleSave} />
        <section className="notes-section">
          <h2>Notes ({notes.length})</h2>
          <NoteList
            notes={notes}
            onRename={handleRename}
            onDelete={handleDelete}
            onSync={handleManualSync}
          />
        </section>
      </main>
      <footer className="app-footer">
        <small>v0.1 · dictée + Google Drive</small>
      </footer>
    </div>
  )
}
