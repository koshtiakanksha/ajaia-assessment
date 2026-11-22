import { useEffect, useState, type ReactNode } from 'react'
import { api, AUTH_EXPIRED_EVENT, type User } from '../api'
import { AuthContext, unsavedChanges } from './context'
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
    if (unsavedChanges.current && !window.confirm('You have unsaved changes. Sign out without saving?')) return
    unsavedChanges.current = false
    await api.logout().catch(() => {})
    setUser(null)
  }

  if (user === undefined) return <p className="muted center">Loading…</p>
  if (user === null) return <Login onSignedIn={setUser} />
  return <AuthContext.Provider value={{ user, logout }}>{children(user)}</AuthContext.Provider>
}
