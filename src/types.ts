export type SyncState = 'local' | 'uploading' | 'synced' | 'error'

export interface Photo {
  id: string
  blob: Blob
  mime: string
  driveUrl?: string
  driveFileId?: string
  syncState: SyncState
  syncError?: string
}

export interface Note {
  id: string
  name: string
  chantier?: string
  tags: string[]
  createdAt: number
  durationMs: number
  audioMime: string
  audioBlob: Blob
  transcript: string
  photos: Photo[]
  syncState: SyncState
  syncError?: string
  driveAudioUrl?: string
  driveTranscriptUrl?: string
  driveFolderUrl?: string
  driveShareUrl?: string
}

export const DEFAULT_TAGS = ['défaut', 'mesure', 'sécurité', 'client', 'planning', 'matériel'] as const
