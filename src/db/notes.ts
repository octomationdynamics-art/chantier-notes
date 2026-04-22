import { openDB, type IDBPDatabase } from 'idb'
import type { Note } from '../types'

const DB_NAME = 'chantier-notes'
const STORE = 'notes'
const VERSION = 2

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
        }
      },
      async blocked() {
        console.warn('IDB upgrade blocked by open connection')
      },
    })
  }
  return dbPromise
}

function normalize(raw: Partial<Note> & { id: string }): Note {
  return {
    id: raw.id,
    name: raw.name ?? '(sans nom)',
    chantier: raw.chantier,
    tags: raw.tags ?? [],
    createdAt: raw.createdAt ?? Date.now(),
    durationMs: raw.durationMs ?? 0,
    audioMime: raw.audioMime ?? 'audio/webm',
    audioBlob: raw.audioBlob ?? new Blob(),
    transcript: raw.transcript ?? '',
    photos: raw.photos ?? [],
    syncState: raw.syncState ?? 'local',
    syncError: raw.syncError,
    driveAudioUrl: raw.driveAudioUrl,
    driveTranscriptUrl: raw.driveTranscriptUrl,
    driveFolderUrl: raw.driveFolderUrl,
    driveShareUrl: raw.driveShareUrl,
  }
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDb()
  await db.put(STORE, note)
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDb()
  const raw = await db.get(STORE, id)
  return raw ? normalize(raw as Partial<Note> & { id: string }) : undefined
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readonly')
  const idx = tx.store.index('createdAt')
  const all = (await idx.getAll()) as Array<Partial<Note> & { id: string }>
  return all.map(normalize).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<Note | undefined> {
  const existing = await getNote(id)
  if (!existing) return undefined
  const updated = { ...existing, ...patch }
  await saveNote(updated)
  return updated
}
