import { useAuth } from '../auth/useAuth'

export function LoginBar() {
  const { ready, isConfigured, account, login, logout, error } = useAuth()

  if (!isConfigured) {
    return (
      <div className="login-bar warn">
        <span>Azure non configuré — les notes resteront locales.</span>
      </div>
    )
  }

  if (!ready) {
    return <div className="login-bar">Initialisation…</div>
  }

  return (
    <div className="login-bar">
      {account ? (
        <>
          <span className="login-email">{account.username}</span>
          <button className="btn-ghost" onClick={logout}>Déconnexion</button>
        </>
      ) : (
        <>
          <span className="login-email muted">Non connecté à OneDrive</span>
          <button className="btn-primary" onClick={login}>Se connecter</button>
        </>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  )
}
