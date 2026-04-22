import { useCallback, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { getActiveAccount, initializeMsal, signIn, signOut } from './msal'
import { isConfigured } from '../config'

export function useAuth() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured()) {
      setReady(true)
      return
    }
    let cancelled = false
    initializeMsal()
      .then(() => {
        if (cancelled) return
        setAccount(getActiveAccount())
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async () => {
    setError(null)
    try {
      const acc = await signIn()
      setAccount(acc)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    try {
      await signOut()
      setAccount(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    ready,
    isConfigured: isConfigured(),
    account,
    error,
    login,
    logout,
  }
}
