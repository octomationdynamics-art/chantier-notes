export type Unsubscribe = () => void

export function onOnline(callback: () => void): Unsubscribe {
  function handle() {
    if (navigator.onLine) callback()
  }
  window.addEventListener('online', handle)
  return () => window.removeEventListener('online', handle)
}

export function onFocus(callback: () => void): Unsubscribe {
  function handle() {
    if (document.visibilityState === 'visible') callback()
  }
  document.addEventListener('visibilitychange', handle)
  window.addEventListener('focus', handle)
  return () => {
    document.removeEventListener('visibilitychange', handle)
    window.removeEventListener('focus', handle)
  }
}
