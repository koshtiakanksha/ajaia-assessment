import { useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import Avatar from './Avatar'
import { useDismiss } from './useDismiss'

/** Google-style account menu: avatar button → name, email, sign out. */
export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="avatar-button"
        aria-label={`Account: ${user.name}`}
        aria-expanded={open}
        title={`${user.name}\n${user.email}`}
        onClick={() => setOpen(!open)}
      >
        <Avatar user={user} size={34} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <Avatar user={user} size={48} />
          <strong>{user.name}</strong>
          <span className="muted">{user.email}</span>
          <button type="button" role="menuitem" onClick={logout}>Sign out</button>
        </div>
      )}
    </div>
  )
}
