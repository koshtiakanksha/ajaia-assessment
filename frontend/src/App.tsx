import { Link, Route, Routes } from 'react-router-dom'
import DocumentList from './pages/DocumentList'
import DocumentEditor from './pages/DocumentEditor'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">Ajaia Docs</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DocumentList />} />
          <Route path="/docs/:id" element={<DocumentEditor />} />
          <Route path="*" element={<p className="error">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  )
}
