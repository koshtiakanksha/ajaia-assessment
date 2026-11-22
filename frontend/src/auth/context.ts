import { createContext, useContext } from 'react'
import type { User } from '../api'

export interface AuthValue {
  user: User
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

/** The signed-in user. Only usable inside <AuthGate> (which guarantees a user). */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthGate>')
  return value
}

/**
 * Set by the editor while it has unsaved changes, so signing out can warn
 * first (sign-out isn't a navigation, so the router's blocker can't catch it).
 */
export const unsavedChanges = { current: false }
