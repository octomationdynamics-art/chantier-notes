export type SyncState = 'local' | 'uploading' | 'synced' | 'error'

export interface Note {
  id: string
  name: string
  createdAt: number
  durationMs: number
  audioMime: string
  audioBlob: Blob
  transcript: string
  syncState: SyncState
  syncError?: string
  driveAudioUrl?: string
  driveTranscriptUrl?: string
  driveFolderUrl?: string
  driveShareUrl?: string
}
