import { useState } from 'react'
import { getAccessToken, getStoredUser } from '../auth/google'
import { cleanupDuplicates } from '../drive/googledrive'

interface TestResult {
  name: string
  status: 'ok' | 'fail' | 'running'
  detail: string
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = []

  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files')
    results.push({
      name: '1. Ping Drive API (sans auth)',
      status: r.status === 403 || r.status === 401 ? 'ok' : 'fail',
      detail: `HTTP ${r.status}${r.status === 403 ? ' (attendu)' : ''}`,
    })
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    results.push({ name: '1. Ping Drive API (sans auth)', status: 'fail', detail: err })
  }

  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files?q=test', {
      headers: { Authorization: 'Bearer fake_token_123' },
    })
    results.push({
      name: '2. Preflight CORS avec Bearer token',
      status: r.status === 401 ? 'ok' : 'fail',
      detail: `HTTP ${r.status}${r.status === 401 ? ' (attendu)' : ''}`,
    })
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    results.push({ name: '2. Preflight CORS avec Bearer token', status: 'fail', detail: err })
  }

  const user = getStoredUser()
  results.push({
    name: '3. Compte connecté',
    status: user ? 'ok' : 'fail',
    detail: user ? user.email : 'Aucun (se connecter d\'abord)',
  })

  if (user) {
    try {
      const token = await getAccessToken()
      results.push({
        name: '4. Récupération access token',
        status: token ? 'ok' : 'fail',
        detail: token ? `Token (${token.length} chars)` : 'Vide',
      })

      try {
        const r = await fetch(
          'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)',
          { headers: { Authorization: `Bearer ${token}` } },
        )
        const body = await r.text()
        results.push({
          name: '5. Requête Drive authentifiée',
          status: r.ok ? 'ok' : 'fail',
          detail: `HTTP ${r.status} · ${body.slice(0, 120)}`,
        })
      } catch (e) {
        const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        results.push({ name: '5. Requête Drive authentifiée', status: 'fail', detail: err })
      }
    } catch (e) {
      const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      results.push({ name: '4. Récupération access token', status: 'fail', detail: err })
    }
  }

  const regs = await navigator.serviceWorker?.getRegistrations?.()
  results.push({
    name: '6. Service Worker',
    status: regs && regs.length > 0 && regs[0].active ? 'ok' : 'fail',
    detail: regs && regs.length > 0 ? `${regs.length} · scope: ${regs[0].scope}` : 'Aucun',
  })

  results.push({
    name: '7. navigator.onLine',
    status: navigator.onLine ? 'ok' : 'fail',
    detail: String(navigator.onLine),
  })

  results.push({
    name: '8. User agent',
    status: 'ok',
    detail: navigator.userAgent.slice(0, 100),
  })

  return results
}

export function Diagnostic() {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [cleanReport, setCleanReport] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  async function handleRun() {
    setRunning(true)
    setResults([])
    try {
      const r = await runTests()
      setResults(r)
    } finally {
      setRunning(false)
    }
  }

  function copyResults() {
    const text = results
      .map((r) => `${r.status === 'ok' ? '✓' : '✗'} ${r.name}: ${r.detail}`)
      .join('\n')
    navigator.clipboard?.writeText(text)
  }

  async function handleCleanup() {
    if (!window.confirm('Supprimer les doublons dans le dossier Chantier Notes de ton Drive ? (garde toujours la version la plus récente)')) return
    setCleaning(true)
    setCleanReport(null)
    try {
      const r = await cleanupDuplicates()
      const folders = r.folders.length > 0 ? r.folders.join(', ') : '—'
      const errs = r.errors.length > 0 ? `\nErreurs : ${r.errors.join(' | ')}` : ''
      setCleanReport(
        `Scanné ${r.scanned} fichier(s) dans ${r.folders.length} dossier(s) [${folders}] · Supprimé ${r.duplicatesDeleted} doublon(s).${errs}`,
      )
    } catch (e) {
      setCleanReport(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCleaning(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-ghost btn-small" onClick={() => setOpen(true)}>
        🩺 Diagnostic
      </button>
    )
  }

  return (
    <div className="diagnostic">
      <div className="diagnostic-head">
        <strong>Diagnostic</strong>
        <button className="btn-ghost btn-small" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="diagnostic-actions">
        <button className="btn-primary btn-small" onClick={handleRun} disabled={running}>
          {running ? 'Test en cours…' : 'Lancer les tests'}
        </button>
        {results.length > 0 && (
          <button className="btn-ghost btn-small" onClick={copyResults}>📋 Copier</button>
        )}
        <button className="btn-ghost btn-small" onClick={handleCleanup} disabled={cleaning}>
          {cleaning ? 'Nettoyage…' : '🧹 Nettoyer doublons Drive'}
        </button>
      </div>
      {cleanReport && <div className="cleanup-report">{cleanReport}</div>}
      <ul className="diagnostic-list">
        {results.map((r, i) => (
          <li key={i} className={`diag-${r.status}`}>
            <span className="diag-icon">{r.status === 'ok' ? '✓' : '✗'}</span>
            <div>
              <div className="diag-name">{r.name}</div>
              <div className="diag-detail">{r.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
