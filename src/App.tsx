import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoginBar } from './components/LoginBar'
import { RecorderPanel } from './components/RecorderPanel'
import { NoteList } from './components/NoteList'
import { Diagnostic } from './components/Diagnostic'
import { deleteNote, listNotes, saveNote, updateNote } from './db/notes'
import {
  deleteNoteFiles,
  deletePhotoFile,
  uploadNote,
  uploadPhoto,
} from './drive/googledrive'
import { getStoredUser } from './auth/google'
import { onFocus, onOnline } from './sync/queue'
import type { Note, Photo } from './types'
import { isConfigured } from './config'
import './App.css'

function generateId(prefix = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultName(createdAt: number): string {
  const d = new Date(createdAt)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `Note ${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

function canSyncRemote(): boolean {
  return isConfigured() && getStoredUser() !== null && navigator.onLine
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [defaultChantier, setDefaultChantier] = useState('')
  const [syncing, setSyncing] = useState(false)
  const syncLockRef = useRef(false)

  const reload = useCallback(async () => {
    const all = await listNotes()
    setNotes(all)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateNoteLocal = useCallback(async (note: Note) => {
    await saveNote(note)
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === note.id)
      if (idx === -1) return [note, ...prev]
      const copy = [...prev]
      copy[idx] = note
      return copy
    })
  }, [])

  const uploadPendingPhotos = useCallback(
    async (note: Note): Promise<Note> => {
      let current = note
      for (let i = 0; i < current.photos.length; i++) {
        const p = current.photos[i]
        if (p.syncState === 'synced') continue
        const uploading: Photo = { ...p, syncState: 'uploading', syncError: undefined }
        current = { ...current, photos: current.photos.map((x, idx) => (idx === i ? uploading : x)) }
        await updateNoteLocal(current)
        try {
          const result = await uploadPhoto({
            baseName: current.name,
            chantier: current.chantier,
            photoId: p.id,
            index: i,
            blob: p.blob,
          })
          const synced: Photo = {
            ...uploading,
            syncState: 'synced',
            driveFileId: result.driveFileId,
            driveUrl: result.driveUrl,
            syncError: undefined,
          }
          current = { ...current, photos: current.photos.map((x, idx) => (idx === i ? synced : x)) }
        } catch (e) {
          const errored: Photo = {
            ...uploading,
            syncState: 'error',
            syncError: e instanceof Error ? e.message : String(e),
          }
          current = { ...current, photos: current.photos.map((x, idx) => (idx === i ? errored : x)) }
        }
        await updateNoteLocal(current)
      }
      return current
    },
    [updateNoteLocal],
  )

  const trySync = useCallback(
    async (noteId: string): Promise<void> => {
      if (!canSyncRemote()) return
      const snapshot = await listNotes().then((arr) => arr.find((x) => x.id === noteId))
      if (!snapshot) return
      const alreadyCore = snapshot.syncState === 'synced'
      const uploading: Note = { ...snapshot, syncState: 'uploading', syncError: undefined }
      await updateNoteLocal(uploading)
      let current = uploading
      try {
        if (!alreadyCore) {
          const result = await uploadNote({
            baseName: current.name,
            chantier: current.chantier,
            audioBlob: current.audioBlob,
            transcript: current.transcript,
          })
          current = {
            ...current,
            driveFolderUrl: result.folderWebUrl,
            driveAudioUrl: result.audioWebUrl,
            driveTranscriptUrl: result.transcriptWebUrl,
            driveShareUrl: result.shareUrl,
            syncError: undefined,
          }
          await updateNoteLocal(current)
        }
        current = await uploadPendingPhotos(current)
        const anyPhotoError = current.photos.some((p) => p.syncState === 'error')
        const synced: Note = {
          ...current,
          syncState: anyPhotoError ? 'error' : 'synced',
          syncError: anyPhotoError ? 'Certaines photos ont échoué' : undefined,
        }
        await updateNoteLocal(synced)
      } catch (e) {
        const errored: Note = {
          ...current,
          syncState: 'error',
          syncError: e instanceof Error ? e.message : String(e),
        }
        await updateNoteLocal(errored)
      }
    },
    [updateNoteLocal, uploadPendingPhotos],
  )

  const syncAllPending = useCallback(async () => {
    if (syncLockRef.current || !canSyncRemote()) return
    syncLockRef.current = true
    setSyncing(true)
    try {
      const all = await listNotes()
      for (const n of all) {
        const needsCore = n.syncState !== 'synced'
        const needsPhotos = n.photos.some((p) => p.syncState !== 'synced')
        if (needsCore || needsPhotos) {
          await trySync(n.id)
        }
      }
    } finally {
      syncLockRef.current = false
      setSyncing(false)
    }
  }, [trySync])

  useEffect(() => {
    void syncAllPending()
    const off1 = onOnline(() => void syncAllPending())
    const off2 = onFocus(() => void syncAllPending())
    return () => {
      off1()
      off2()
    }
  }, [syncAllPending])

  const handleSave = useCallback(
    async (params: {
      blob: Blob
      mimeType: string
      durationMs: number
      transcript: string
      chantier?: string
      tags: string[]
      photos: Photo[]
    }) => {
      const createdAt = Date.now()
      const note: Note = {
        id: generateId(),
        name: defaultName(createdAt),
        chantier: params.chantier,
        tags: params.tags,
        createdAt,
        durationMs: params.durationMs,
        audioMime: params.mimeType,
        audioBlob: params.blob,
        transcript: params.transcript,
        photos: params.photos,
        syncState: 'local',
      }
      await updateNoteLocal(note)
      await trySync(note.id)
    },
    [updateNoteLocal, trySync],
  )

  const handleRename = useCallback(
    async (id: string, name: string) => {
      const updated = await updateNote(id, { name })
      if (!updated) return
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
      if (updated.syncState === 'synced' || updated.syncState === 'error') {
        const resynced: Note = {
          ...updated,
          syncState: 'local',
          driveAudioUrl: undefined,
          driveTranscriptUrl: undefined,
          driveShareUrl: undefined,
        }
        await updateNoteLocal(resynced)
        await trySync(id)
      }
    },
    [updateNoteLocal, trySync],
  )

  const handleChangeChantier = useCallback(
    async (id: string, chantier: string) => {
      const existing = await listNotes().then((arr) => arr.find((x) => x.id === id))
      if (!existing) return
      const wasSynced = existing.syncState === 'synced'
      if (wasSynced && canSyncRemote()) {
        try {
          await deleteNoteFiles({
            baseName: existing.name,
            chantier: existing.chantier,
            photoCount: existing.photos.length,
          })
        } catch {
          /* best effort */
        }
      }
      const updated: Note = {
        ...existing,
        chantier: chantier.trim() || undefined,
        syncState: 'local',
        driveAudioUrl: undefined,
        driveTranscriptUrl: undefined,
        driveFolderUrl: undefined,
        driveShareUrl: undefined,
        photos: existing.photos.map((p) => ({
          ...p,
          syncState: 'local' as const,
          driveFileId: undefined,
          driveUrl: undefined,
        })),
      }
      await updateNoteLocal(updated)
      if (chantier.trim()) setDefaultChantier(chantier.trim())
      await trySync(id)
    },
    [updateNoteLocal, trySync],
  )

  const handleChangeTags = useCallback(
    async (id: string, tags: string[]) => {
      const updated = await updateNote(id, { tags })
      if (updated) setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    },
    [],
  )

  const handleAddPhotos = useCallback(
    async (id: string, files: File[]) => {
      const existing = await listNotes().then((arr) => arr.find((x) => x.id === id))
      if (!existing) return
      const newPhotos: Photo[] = files.map((f) => ({
        id: generateId('p'),
        blob: f,
        mime: f.type || 'image/jpeg',
        syncState: 'local',
      }))
      const updated: Note = { ...existing, photos: [...existing.photos, ...newPhotos] }
      await updateNoteLocal(updated)
      await trySync(id)
    },
    [updateNoteLocal, trySync],
  )

  const handleDeletePhoto = useCallback(
    async (id: string, photoId: string) => {
      const existing = await listNotes().then((arr) => arr.find((x) => x.id === id))
      if (!existing) return
      const target = existing.photos.find((p) => p.id === photoId)
      if (target?.driveFileId && canSyncRemote()) {
        try {
          await deletePhotoFile(target.driveFileId)
        } catch {
          /* best effort */
        }
      }
      const updated: Note = {
        ...existing,
        photos: existing.photos.filter((p) => p.id !== photoId),
      }
      await updateNoteLocal(updated)
    },
    [updateNoteLocal],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const target = notes.find((n) => n.id === id)
      await deleteNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (target && target.syncState === 'synced' && canSyncRemote()) {
        try {
          await deleteNoteFiles({
            baseName: target.name,
            chantier: target.chantier,
            photoCount: target.photos.length,
          })
        } catch {
          /* best effort */
        }
      }
    },
    [notes],
  )

  const handleManualSync = useCallback(
    async (id: string) => {
      await trySync(id)
    },
    [trySync],
  )

  const chantierSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) if (n.chantier) set.add(n.chantier)
    return Array.from(set).sort()
  }, [notes])

  const tagSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) for (const t of n.tags) set.add(t)
    return Array.from(set).sort()
  }, [notes])

  const pendingCount = useMemo(() => {
    return notes.filter(
      (n) => n.syncState !== 'synced' || n.photos.some((p) => p.syncState !== 'synced'),
    ).length
  }, [notes])

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏗️ Chantier Notes</h1>
        <LoginBar />
        {pendingCount > 0 && (
          <div className="sync-indicator">
            {syncing ? '⏳ Sync en cours…' : `☁️ ${pendingCount} à envoyer`}
            {!syncing && canSyncRemote() && (
              <button className="btn-ghost btn-small" onClick={() => void syncAllPending()}>
                Réessayer
              </button>
            )}
          </div>
        )}
      </header>
      <main className="app-main">
        <RecorderPanel
          chantierSuggestions={chantierSuggestions}
          tagSuggestions={tagSuggestions}
          defaultChantier={defaultChantier}
          onChangeDefaultChantier={setDefaultChantier}
          onSave={handleSave}
        />
        <section className="notes-section">
          <h2>Notes ({notes.length})</h2>
          <NoteList
            notes={notes}
            chantierSuggestions={chantierSuggestions}
            tagSuggestions={tagSuggestions}
            onRename={handleRename}
            onDelete={handleDelete}
            onSync={handleManualSync}
            onChangeChantier={handleChangeChantier}
            onChangeTags={handleChangeTags}
            onAddPhotos={handleAddPhotos}
            onDeletePhoto={handleDeletePhoto}
          />
        </section>
      </main>
      <footer className="app-footer">
        <small>v0.2.4 · dictée + Google Drive + photos</small>
        <div style={{ marginTop: 8 }}>
          <Diagnostic />
        </div>
      </footer>
    </div>
  )
}
