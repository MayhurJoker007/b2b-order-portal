import { useState, type FormEvent } from 'react'
import { ApiError, type Api } from './api'

export function Login({ api, onLoggedIn }: { api: Api; onLoggedIn: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(username.trim(), password)
      onLoggedIn(username.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Order portal</h1>
      <p className="muted">Sign in with your store's account.</p>
      <label>
        Username
        <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
               autoComplete="current-password" required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
