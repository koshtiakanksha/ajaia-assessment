import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type DocumentSummary } from '../api'

export default function DocumentList() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.listDocuments().then(setDocs).catch((e) => setError(e.message))
  }, [])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const doc = await api.createDocument()
      navigate(`/docs/${doc.id}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  return (
    <section className="doc-list">
      <div className="doc-list-header">
        <h1>My documents</h1>
        <button className="primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : '+ New document'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {docs === null && !error && <p className="muted">Loading…</p>}
      {docs?.length === 0 && <p className="muted">No documents yet. Create your first one!</p>}

      <ul>
        {docs?.map((doc) => (
          <li key={doc.id}>
            <Link to={`/docs/${doc.id}`}>
              <span className="doc-title">{doc.title}</span>
              <span className="muted">Edited {new Date(doc.updated_at).toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
