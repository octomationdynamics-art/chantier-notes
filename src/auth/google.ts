import { config } from '../config'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_STORAGE_KEY = 'chantier-notes.google.token'
const USER_STORAGE_KEY = 'chantier-notes.google.user'

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string; hint?: string }): void
  callback: (response: TokenResponse) => void
}

interface GsiOAuth2 {
  initTokenClient(c: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type: string; message?: string }) => void
    prompt?: string
    hint?: string
  }): TokenClient
  revoke(accessToken: string, done: () => void): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GsiOAuth2
      }
    }
  }
}

export interface GoogleUser {
  email: string
  name?: string
  picture?: string
}

export interface StoredToken {
  accessToken: string
  expiresAt: number
}

let gsiLoadPromise: Promise<void> | null = null
let tokenClient: TokenClient | null = null

export function loadGoogleIdentity(): Promise<void> {
  if (gsiLoadPromise) return gsiLoadPromise
  gsiLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser'))
      return
    }
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Chargement GSI échoué')))
      return
    }
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Chargement GSI échoué'))
    document.head.appendChild(s)
  })
  return gsiLoadPromise
}

function saveToken(token: StoredToken) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token))
}

function readToken(): StoredToken | null {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredToken
    if (!parsed.accessToken || !parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getStoredUser(): GoogleUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GoogleUser
  } catch {
    return null
  }
}

function saveUser(user: GoogleUser) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

function clearUser() {
  localStorage.removeItem(USER_STORAGE_KEY)
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`userinfo ${res.status}`)
  const data = (await res.json()) as { email: string; name?: string; picture?: string }
  return { email: data.email, name: data.name, picture: data.picture }
}

async function ensureTokenClient(): Promise<TokenClient> {
  await loadGoogleIdentity()
  if (!config.googleClientId) throw new Error('Google Client ID non configuré')
  if (!window.google) throw new Error('GSI indisponible')
  if (tokenClient) return tokenClient
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: config.googleClientId,
    scope: DRIVE_SCOPE,
    callback: () => {
      /* replaced per request */
    },
  })
  return tokenClient
}

export async function signIn(): Promise<GoogleUser> {
  const client = await ensureTokenClient()
  return new Promise<GoogleUser>((resolve, reject) => {
    client.callback = async (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error))
        return
      }
      const expiresAt = Date.now() + response.expires_in * 1000 - 60_000
      saveToken({ accessToken: response.access_token, expiresAt })
      try {
        const user = await fetchUserInfo(response.access_token)
        saveUser(user)
        resolve(user)
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    }
    try {
      client.requestAccessToken({ prompt: 'consent' })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

async function refreshTokenSilently(): Promise<string> {
  const client = await ensureTokenClient()
  const user = getStoredUser()
  return new Promise<string>((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error))
        return
      }
      const expiresAt = Date.now() + response.expires_in * 1000 - 60_000
      saveToken({ accessToken: response.access_token, expiresAt })
      resolve(response.access_token)
    }
    try {
      client.requestAccessToken({ prompt: '', hint: user?.email })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export async function getAccessToken(): Promise<string> {
  const stored = readToken()
  if (stored && stored.expiresAt > Date.now()) return stored.accessToken
  return refreshTokenSilently()
}

export async function signOut(): Promise<void> {
  const stored = readToken()
  clearToken()
  clearUser()
  if (stored?.accessToken && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(stored.accessToken, () => resolve())
    })
  }
}

export async function initGoogleAuth(): Promise<GoogleUser | null> {
  if (!config.googleClientId) return null
  await loadGoogleIdentity()
  return getStoredUser()
}
