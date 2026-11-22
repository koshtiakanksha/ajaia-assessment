import { Link, Outlet } from 'react-router-dom'

/** App shell: header + the current page. */
export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">Ajaia Docs</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
