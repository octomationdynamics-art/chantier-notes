import { useCallback, useEffect, useState } from 'react'
import { initGoogleAuth, signIn, signOut, type GoogleUser } from './google'
import { isConfigured } from '../config'

export function useAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConfigured()) {
      setReady(true)
      return
    }
    let cancelled = false
    initGoogleAuth()
      .then((u) => {
        if (cancelled) return
        setUser(u)
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
      const u = await signIn()
      setUser(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    try {
      await signOut()
      setUser(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return {
    ready,
    isConfigured: isConfigured(),
    user,
    error,
    login,
    logout,
  }
}
