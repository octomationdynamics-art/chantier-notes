import { getAccessToken } from '../auth/google'
import { config } from '../config'

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const CHUNK_SIZE = 5 * 1024 * 1024

export interface UploadResult {
  fileId: string
  webViewLink: string
}

async function authed(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

function sanitize(name: string): string {
  return name.replace(/[\\/]/g, '_').trim()
}

async function findFolderByName(name: string): Promise<{ id: string; webViewLink: string } | null> {
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  )
  const res = await authed(`${DRIVE}/files?q=${q}&fields=files(id,webViewLink)&pageSize=1`)
  if (!res.ok) throw new Error(`findFolder ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { files: Array<{ id: string; webViewLink: string }> }
  return data.files[0] ?? null
}

async function createFolder(name: string): Promise<{ id: string; webViewLink: string }> {
  const res = await authed(`${DRIVE}/files?fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  if (!res.ok) throw new Error(`createFolder ${res.status}: ${await res.text()}`)
  return (await res.json()) as { id: string; webViewLink: string }
}

async function ensureFolder(name: string): Promise<{ id: string; webViewLink: string }> {
  const existing = await findFolderByName(name)
  if (existing) return existing
  return createFolder(name)
}

async function findFileInFolder(
  folderId: string,
  name: string,
): Promise<{ id: string } | null> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
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
  const boundary = `----chantier-notes-${Math.random().toString(36).slice(2)}`
  const metadata = { name: filename, parents: [folderId] }
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  const fileHeader = `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  const closing = `\r\n--${boundary}--`

  const body =
    typeof data === 'string'
      ? new Blob([metadataPart, fileHeader, data, closing])
      : new Blob([metadataPart, fileHeader, data, closing])

  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`uploadMultipart ${res.status}: ${await res.text()}`)
  return (await res.json()) as UploadResult
}

async function uploadResumable(
  folderId: string,
  filename: string,
  blob: Blob,
): Promise<UploadResult> {
  const initRes = await authed(
    `${UPLOAD}/files?uploadType=resumable&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify({ name: filename, parents: [folderId] }),
    },
  )
  if (!initRes.ok) throw new Error(`initResumable ${initRes.status}: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) throw new Error('No resumable upload URL')

  const total = blob.size
  let offset = 0
  let last: UploadResult | null = null
  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total)
    const chunk = blob.slice(offset, end)
    const res = await fetch(uploadUrl, {
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
  const existing = typeof data === 'string' ? null : await findFileInFolder(folderId, filename)
  if (existing) {
    await authed(`${DRIVE}/files/${existing.id}`, { method: 'DELETE' }).catch(() => undefined)
  }
  const asBlob = typeof data === 'string' ? new Blob([data], { type: contentType }) : data
  if (asBlob.size > 4 * 1024 * 1024) {
    return uploadResumable(folderId, filename, asBlob)
  }
  return uploadMultipart(folderId, filename, data, contentType)
}

async function createShareLink(fileId: string): Promise<string> {
  await authed(`${DRIVE}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  const res = await authed(`${DRIVE}/files/${fileId}?fields=webViewLink`)
  if (!res.ok) throw new Error(`fetch share ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { webViewLink: string }
  return data.webViewLink
}

export interface NoteUpload {
  folderWebUrl: string
  audioWebUrl: string
  transcriptWebUrl: string
  shareUrl: string
}

export async function uploadNote(params: {
  baseName: string
  audioBlob: Blob
  transcript: string
}): Promise<NoteUpload> {
  const folder = await ensureFolder(config.driveFolderName)
  const safe = sanitize(params.baseName)

  const ext = params.audioBlob.type.includes('mp4')
    ? 'm4a'
    : params.audioBlob.type.includes('ogg')
    ? 'ogg'
    : 'webm'
  const audioName = `${safe}.${ext}`
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

export async function deleteNoteFiles(baseName: string): Promise<void> {
  const folder = await findFolderByName(config.driveFolderName)
  if (!folder) return
  const safe = sanitize(baseName)
  const names = [`${safe}.webm`, `${safe}.m4a`, `${safe}.ogg`, `${safe}.txt`]
  for (const name of names) {
    const file = await findFileInFolder(folder.id, name).catch(() => null)
    if (file) {
      await authed(`${DRIVE}/files/${file.id}`, { method: 'DELETE' }).catch(() => undefined)
    }
  }
}
