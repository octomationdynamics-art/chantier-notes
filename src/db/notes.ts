import { openDB, type IDBPDatabase } from 'idb'
import type { Note } from '../types'

const DB_NAME = 'chantier-notes'
const STORE = 'notes'
const VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDb()
  await db.put(STORE, note)
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDb()
  return db.get(STORE, id)
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readonly')
  const idx = tx.store.index('createdAt')
  const all = await idx.getAll()
  return all.sort((a, b) => b.createdAt - a.createdAt)
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
