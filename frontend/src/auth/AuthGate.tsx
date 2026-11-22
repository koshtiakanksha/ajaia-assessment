import { useEffect, useState, type ReactNode } from 'react'
import { api, AUTH_EXPIRED_EVENT, type User } from '../api'
import { AuthContext, pendingSave } from './context'
import Login from './Login'

/** Renders the sign-in screen until a user is signed in, then the app. */
export default function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = checking

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null))
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  async function logout() {
    // Save any pending edits first; only ask if they can't be saved.
    if (pendingSave.current && !(await pendingSave.current())) {
      if (!window.confirm('Your latest changes could not be saved. Sign out anyway?')) return
    }
    pendingSave.current = null
    await api.logout().catch(() => {})
    setUser(null)
  }

  if (user === undefined) return <p className="muted center">Loading…</p>
  if (user === null) return <Login onSignedIn={setUser} />
  return <AuthContext.Provider value={{ user, logout }}>{children(user)}</AuthContext.Provider>
}
