import { Link, Outlet } from 'react-router-dom'
import AuthGate from './auth/AuthGate'
import { useAuth } from './auth/context'
import Avatar from './components/Avatar'

function UserMenu() {
  const { user, logout } = useAuth()
  return (
    <div className="user-menu">
      <Avatar user={user} size={28} />
      <span className="user-name" title={user.email}>{user.name}</span>
      <button className="link-button" onClick={logout}>Sign out</button>
    </div>
  )
}

/** App shell: header + the current page, for signed-in users only. */
export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <div className="app">
          <header className="app-header">
            <Link to="/" className="brand">Ajaia Docs</Link>
            <UserMenu />
          </header>
          <main>
            {/* key: re-render pages from scratch when switching accounts */}
            <Outlet key={user.id} />
          </main>
        </div>
      )}
    </AuthGate>
  )
}
