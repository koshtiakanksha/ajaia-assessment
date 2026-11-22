import { useEffect, useState, type FormEvent } from 'react'
import { api, isValidEmail, type User } from '../api'
import Avatar from '../components/Avatar'

export default function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [demoUsers, setDemoUsers] = useState<User[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.demoUsers().then(setDemoUsers).catch((e) => setError(e.message))
  }, [])

  async function signIn(address: string) {
    setBusy(true)
    setError(null)
    try {
      onSignedIn(await api.login(address))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    signIn(email.trim())
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <h1>Ajaia Docs</h1>
        <p className="muted">Demo sign-in: no password needed. Pick an account or use any email.</p>

        <div className="demo-users">
          {demoUsers.map((u) => (
            <button key={u.id} className="demo-user" onClick={() => signIn(u.email)} disabled={busy}>
              <Avatar user={u} />
              <span>
                <strong>{u.name}</strong>
                <span className="muted">{u.email}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="divider"><span>or</span></div>

        <form onSubmit={onSubmit} className="login-form" noValidate>
          <input
            type="email"
            placeholder="you@company.com"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary" disabled={busy || !email.trim()}>Continue</button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </div>
  )
}
