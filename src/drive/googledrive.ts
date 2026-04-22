import { getAccessToken } from '../auth/google'
import { config } from '../config'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const CHUNK_SIZE = 5 * 1024 * 1024
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export interface UploadResult {
  fileId: string
  webViewLink: string
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init)
    } catch (e) {
      lastError = e
      if (attempt === retries) break
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Réseau: ${msg} (URL: ${new URL(url).hostname})`)
}

async function authed(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetchWithRetry(url, { ...init, headers })
}

function sanitize(name: string): string {
  return name.replace(/[\\/]/g, '_').trim()
}

function escapeForQuery(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findFolder(name: string, parentId?: string): Promise<{ id: string; webViewLink: string } | null> {
  const parts = [
    `name='${escapeForQuery(name)}'`,
    `mimeType='${FOLDER_MIME}'`,
    `trashed=false`,
    parentId ? `'${parentId}' in parents` : null,
  ].filter(Boolean)
  const q = encodeURIComponent(parts.join(' and '))
  const res = await authed(`${DRIVE}/files?q=${q}&fields=files(id,webViewLink)&pageSize=1`)
  if (!res.ok) throw new Error(`findFolder ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { files: Array<{ id: string; webViewLink: string }> }
  return data.files[0] ?? null
}

async function createFolder(name: string, parentId?: string): Promise<{ id: string; webViewLink: string }> {
  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME }
  if (parentId) body.parents = [parentId]
  const res = await authed(`${DRIVE}/files?fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`createFolder ${res.status}: ${await res.text()}`)
  return (await res.json()) as { id: string; webViewLink: string }
}

async function ensureFolder(name: string, parentId?: string): Promise<{ id: string; webViewLink: string }> {
  const existing = await findFolder(name, parentId)
  if (existing) return existing
  return createFolder(name, parentId)
}

export async function ensureFolderPath(...segments: string[]): Promise<{ id: string; webViewLink: string }> {
  let parent: { id: string; webViewLink: string } | undefined
  for (const seg of segments) {
    const folder = await ensureFolder(sanitize(seg), parent?.id)
    parent = folder
  }
  if (!parent) throw new Error('ensureFolderPath called with no segments')
  return parent
}

async function findFileInFolder(folderId: string, name: string): Promise<{ id: string } | null> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${escapeForQuery(name)}' and trashed=false`,
  )
  const res = await authed(`${DRIVE}/files?q=${q}&fields=files(id)&pageSize=1`)
  if (!res.ok) return null
  const data = (await res.json()) as { files: Array<{ id: string }> }
  return data.files[0] ?? null
}

async function uploadMultipart(
  folderId: string,
  filename: string,
  data: Blob | string,
  contentType: string,
): Promise<UploadResult> {
  const boundary = `----chantier-${Math.random().toString(36).slice(2)}`
  const metadata = { name: filename, parents: [folderId] }
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  const fileHeader = `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  const closing = `\r\n--${boundary}--`
  const body = new Blob([metadataPart, fileHeader, data, closing])

  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`uploadMultipart ${res.status}: ${await res.text()}`)
  return (await res.json()) as UploadResult
}

async function uploadResumable(folderId: string, filename: string, blob: Blob): Promise<UploadResult> {
  const initRes = await authed(`${UPLOAD}/files?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': blob.type || 'application/octet-stream',
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify({ name: filename, parents: [folderId] }),
  })
  if (!initRes.ok) throw new Error(`initResumable ${initRes.status}: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) throw new Error('No resumable upload URL')

  const total = blob.size
  let offset = 0
  let last: UploadResult | null = null
  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total)
    const chunk = blob.slice(offset, end)
    const res = await fetchWithRetry(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.size),
        'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
      },
      body: chunk,
    })
    if (res.status === 308) {
      offset = end
      continue
    }
    if (res.status === 200 || res.status === 201) {
      last = (await res.json()) as UploadResult
      offset = end
      break
    }
    throw new Error(`chunk ${res.status}: ${await res.text()}`)
  }
  if (!last) throw new Error('Resumable upload finished without final body')
  return last
}

async function uploadToFolder(
  folderId: string,
  filename: string,
  data: Blob | string,
  contentType: string,
): Promise<UploadResult> {
  if (typeof data !== 'string') {
    const existing = await findFileInFolder(folderId, filename)
    if (existing) await authed(`${DRIVE}/files/${existing.id}`, { method: 'DELETE' }).catch(() => undefined)
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: contentType }) : data
  if (blob.size > 4 * 1024 * 1024) return uploadResumable(folderId, filename, blob)
  return uploadMultipart(folderId, filename, data, contentType)
}

async function createShareLink(fileId: string): Promise<string> {
  await authed(`${DRIVE}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => undefined)
  const res = await authed(`${DRIVE}/files/${fileId}?fields=webViewLink`)
  if (!res.ok) throw new Error(`fetch share ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { webViewLink: string }
  return data.webViewLink
}

export interface PhotoUploadResult {
  photoId: string
  driveFileId: string
  driveUrl: string
}

export interface NoteUploadResult {
  folderWebUrl: string
  audioWebUrl: string
  transcriptWebUrl: string
  shareUrl: string
}

function audioExt(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

function photoExt(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  return 'jpg'
}

async function resolveNoteFolder(chantier: string | undefined): Promise<{ id: string; webViewLink: string }> {
  const segments = [config.driveFolderName]
  if (chantier && chantier.trim()) segments.push(chantier.trim())
  return ensureFolderPath(...segments)
}

export async function uploadNote(params: {
  baseName: string
  chantier: string | undefined
  audioBlob: Blob
  transcript: string
}): Promise<NoteUploadResult> {
  const folder = await resolveNoteFolder(params.chantier)
  const safe = sanitize(params.baseName)
  const audioName = `${safe}.${audioExt(params.audioBlob.type || 'audio/webm')}`
  const transcriptName = `${safe}.txt`

  const audio = await uploadToFolder(folder.id, audioName, params.audioBlob, params.audioBlob.type || 'audio/webm')
  const transcript = await uploadToFolder(
    folder.id,
    transcriptName,
    params.transcript || '(transcription vide)',
    'text/plain; charset=utf-8',
  )
  const shareUrl = await createShareLink(audio.fileId)

  return {
    folderWebUrl: folder.webViewLink,
    audioWebUrl: audio.webViewLink,
    transcriptWebUrl: transcript.webViewLink,
    shareUrl,
  }
}

export async function uploadPhoto(params: {
  baseName: string
  chantier: string | undefined
  photoId: string
  index: number
  blob: Blob
}): Promise<PhotoUploadResult> {
  const folder = await resolveNoteFolder(params.chantier)
  const ext = photoExt(params.blob.type || 'image/jpeg')
  const name = `${sanitize(params.baseName)}-photo-${String(params.index + 1).padStart(2, '0')}.${ext}`
  const result = await uploadToFolder(folder.id, name, params.blob, params.blob.type || 'image/jpeg')
  return {
    photoId: params.photoId,
    driveFileId: result.fileId,
    driveUrl: result.webViewLink,
  }
}

export async function deleteNoteFiles(params: {
  baseName: string
  chantier: string | undefined
  photoCount: number
}): Promise<void> {
  const folder = await findFolder(
    sanitize(params.chantier?.trim() ? params.chantier.trim() : config.driveFolderName),
    undefined,
  ).catch(() => null)
  if (!folder) return
  const safe = sanitize(params.baseName)
  const names = [`${safe}.webm`, `${safe}.m4a`, `${safe}.ogg`, `${safe}.txt`]
  for (let i = 0; i < params.photoCount; i++) {
    const idx = String(i + 1).padStart(2, '0')
    names.push(`${safe}-photo-${idx}.jpg`, `${safe}-photo-${idx}.png`, `${safe}-photo-${idx}.webp`)
  }
  for (const name of names) {
    const file = await findFileInFolder(folder.id, name).catch(() => null)
    if (file) await authed(`${DRIVE}/files/${file.id}`, { method: 'DELETE' }).catch(() => undefined)
  }
}

export async function deletePhotoFile(fileId: string): Promise<void> {
  await authed(`${DRIVE}/files/${fileId}`, { method: 'DELETE' }).catch(() => undefined)
}
