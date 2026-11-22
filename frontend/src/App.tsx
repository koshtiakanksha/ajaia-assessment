import { Link, Outlet, useMatch } from 'react-router-dom'
import AuthGate from './auth/AuthGate'
import UserMenu from './components/UserMenu'

/** App shell for signed-in users. The editor page renders its own Docs-style header. */
export default function App() {
  const inEditor = useMatch('/docs/:id')
  return (
    <AuthGate>
      {(user) => (
        <div className="app">
          {!inEditor && (
            <header className="app-header">
              <Link to="/" className="brand" aria-label="Ajaia Docs home">
                <img src="/brand/ajaia-logo.png" alt="Ajaia" height={22} />
                <span className="brand-product">Docs</span>
              </Link>
              <UserMenu />
            </header>
          )}
          {/* key: re-render pages from scratch when switching accounts */}
          <Outlet key={user.id} />
        </div>
      )}
    </AuthGate>
  )
}
