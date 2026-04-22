import { useAuth } from '../auth/useAuth'

export function LoginBar() {
  const { ready, isConfigured, user, login, logout, error } = useAuth()

  if (!isConfigured) {
    return (
      <div className="login-bar warn">
        <span>Google Drive non configuré — les notes resteront locales.</span>
      </div>
    )
  }

  if (!ready) {
    return <div className="login-bar">Initialisation…</div>
  }

  return (
    <div className="login-bar">
      {user ? (
        <>
          <span className="login-email" title={user.email}>{user.email}</span>
          <button className="btn-ghost" onClick={logout}>Déconnexion</button>
        </>
      ) : (
        <>
          <span className="login-email muted">Non connecté à Google Drive</span>
          <button className="btn-primary" onClick={login}>Se connecter</button>
        </>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  )
}
