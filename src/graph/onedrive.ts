import { getAccessToken } from '../auth/msal'
import { config } from '../config'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const CHUNK_SIZE = 5 * 1024 * 1024

export interface UploadResult {
  itemId: string
  webUrl: string
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

async function ensureFolder(name: string): Promise<{ id: string; webUrl: string }> {
  const encoded = encodeURIComponent(name)
  const getRes = await authedFetch(`${GRAPH}/me/drive/root:/${encoded}`)
  if (getRes.ok) {
    const item = (await getRes.json()) as { id: string; webUrl: string }
    return { id: item.id, webUrl: item.webUrl }
  }
  if (getRes.status !== 404) {
    throw new Error(`Graph folder check failed: ${getRes.status} ${await getRes.text()}`)
  }
  const createRes = await authedFetch(`${GRAPH}/me/drive/root/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace',
    }),
  })
  if (!createRes.ok) {
    throw new Error(`Graph folder create failed: ${createRes.status} ${await createRes.text()}`)
  }
  const created = (await createRes.json()) as { id: string; webUrl: string }
  return { id: created.id, webUrl: created.webUrl }
}

function safePath(folder: string, filename: string): string {
  const cleaned = filename.replace(/[\\/:*?"<>|]/g, '_').trim()
  return `${encodeURIComponent(folder)}/${encodeURIComponent(cleaned)}`
}

export async function uploadSmallFile(
  folder: string,
  filename: string,
  data: Blob | string,
  contentType: string,
): Promise<UploadResult> {
  const path = safePath(folder, filename)
  const res = await authedFetch(`${GRAPH}/me/drive/root:/${path}:/content?@microsoft.graph.conflictBehavior=replace`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: data,
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
  }
  const item = (await res.json()) as { id: string; webUrl: string }
  return { itemId: item.id, webUrl: item.webUrl }
}

export async function uploadLargeFile(
  folder: string,
  filename: string,
  blob: Blob,
): Promise<UploadResult> {
  const path = safePath(folder, filename)
  const createSessionRes = await authedFetch(
    `${GRAPH}/me/drive/root:/${path}:/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'replace', name: filename },
      }),
    },
  )
  if (!createSessionRes.ok) {
    throw new Error(`Upload session failed: ${createSessionRes.status} ${await createSessionRes.text()}`)
  }
  const { uploadUrl } = (await createSessionRes.json()) as { uploadUrl: string }

  const total = blob.size
  let offset = 0
  let lastItem: { id: string; webUrl: string } | null = null

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
    if (res.status === 202) {
      offset = end
      continue
    }
    if (res.status === 200 || res.status === 201) {
      lastItem = (await res.json()) as { id: string; webUrl: string }
      offset = end
      break
    }
    throw new Error(`Chunk upload failed: ${res.status} ${await res.text()}`)
  }

  if (!lastItem) {
    throw new Error('Upload terminated without final response')
  }
  return { itemId: lastItem.id, webUrl: lastItem.webUrl }
}

export async function uploadBlob(
  folder: string,
  filename: string,
  blob: Blob,
): Promise<UploadResult> {
  if (blob.size <= 4 * 1024 * 1024) {
    return uploadSmallFile(folder, filename, blob, blob.type || 'application/octet-stream')
  }
  return uploadLargeFile(folder, filename, blob)
}

export async function createShareLink(itemId: string): Promise<string> {
  const res = await authedFetch(`${GRAPH}/me/drive/items/${itemId}/createLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
  })
  if (!res.ok) {
    throw new Error(`Share link failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { link: { webUrl: string } }
  return data.link.webUrl
}

export async function deleteItemByPath(folder: string, filename: string): Promise<void> {
  const path = safePath(folder, filename)
  const res = await authedFetch(`${GRAPH}/me/drive/root:/${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete failed: ${res.status} ${await res.text()}`)
  }
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
  const folderName = config.oneDriveFolderName
  const folder = await ensureFolder(folderName)

  const audioExt = params.audioBlob.type.includes('mp4')
    ? 'm4a'
    : params.audioBlob.type.includes('ogg')
    ? 'ogg'
    : 'webm'
  const audioName = `${params.baseName}.${audioExt}`
  const transcriptName = `${params.baseName}.txt`

  const audio = await uploadBlob(folderName, audioName, params.audioBlob)
  const transcript = await uploadSmallFile(
    folderName,
    transcriptName,
    params.transcript || '(transcription vide)',
    'text/plain; charset=utf-8',
  )
  const shareUrl = await createShareLink(audio.itemId)

  return {
    folderWebUrl: folder.webUrl,
    audioWebUrl: audio.webUrl,
    transcriptWebUrl: transcript.webUrl,
    shareUrl,
  }
}

export async function deleteNoteFiles(baseName: string): Promise<void> {
  const folderName = config.oneDriveFolderName
  await Promise.all([
    deleteItemByPath(folderName, `${baseName}.webm`).catch(() => undefined),
    deleteItemByPath(folderName, `${baseName}.m4a`).catch(() => undefined),
    deleteItemByPath(folderName, `${baseName}.ogg`).catch(() => undefined),
    deleteItemByPath(folderName, `${baseName}.txt`).catch(() => undefined),
  ])
}
