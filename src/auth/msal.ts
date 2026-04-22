import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
  type Configuration,
} from '@azure/msal-browser'
import { config } from '../config'

export const GRAPH_SCOPES = ['Files.ReadWrite', 'User.Read', 'offline_access']

let pca: PublicClientApplication | null = null
let initPromise: Promise<void> | null = null

export function getMsal(): PublicClientApplication {
  if (!pca) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.azureClientId,
        authority: config.azureAuthority,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    }
    pca = new PublicClientApplication(msalConfig)
  }
  return pca
}

export async function initializeMsal(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const app = getMsal()
      await app.initialize()
      const response = await app.handleRedirectPromise()
      if (response?.account) {
        app.setActiveAccount(response.account)
      } else {
        const accounts = app.getAllAccounts()
        if (accounts.length > 0 && !app.getActiveAccount()) {
          app.setActiveAccount(accounts[0])
        }
      }
    })()
  }
  return initPromise
}

export function getActiveAccount(): AccountInfo | null {
  return getMsal().getActiveAccount()
}

export async function signIn(): Promise<AccountInfo> {
  const app = getMsal()
  await initializeMsal()
  try {
    const result = await app.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account' })
    app.setActiveAccount(result.account)
    return result.account
  } catch (e) {
    const isBlocked = (e as Error)?.message?.toLowerCase().includes('popup')
    if (isBlocked) {
      await app.loginRedirect({ scopes: GRAPH_SCOPES })
      throw new Error('Redirection en cours')
    }
    throw e
  }
}

export async function signOut(): Promise<void> {
  const app = getMsal()
  const account = app.getActiveAccount()
  if (!account) return
  await app.logoutPopup({ account }).catch(() => app.logoutRedirect({ account }))
}

export async function getAccessToken(): Promise<string> {
  const app = getMsal()
  await initializeMsal()
  const account = app.getActiveAccount() ?? app.getAllAccounts()[0]
  if (!account) throw new Error('Non connecté')
  app.setActiveAccount(account)
  try {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    })
    return result.accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const result = await app.acquireTokenPopup({ scopes: GRAPH_SCOPES, account })
      return result.accessToken
    }
    throw e
  }
}
