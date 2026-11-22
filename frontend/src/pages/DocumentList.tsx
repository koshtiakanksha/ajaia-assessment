import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, IMPORT_EXTENSIONS, MAX_IMPORT_MB, validateImportFile, type DocumentSummary } from '../api'

export default function DocumentList() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'creating' | 'importing' | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    api.listDocuments().then(setDocs).catch((e) => setError(e.message))
  }, [])

  async function handleCreate() {
    setBusy('creating')
    setError(null)
    try {
      const doc = await api.createDocument()
      navigate(`/docs/${doc.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  // Shared by the "Import file" button and drag-and-drop.
  async function handleImport(files: FileList | null) {
    if (!files || files.length === 0 || busy) return
    if (files.length > 1) {
      setError('Please import one file at a time.')
      return
    }
    const file = files[0]
    const problem = validateImportFile(file)
    if (problem) {
      setError(problem)
      return
    }
    setBusy('importing')
    setError(null)
    try {
      const doc = await api.importDocument(file)
      navigate(`/docs/${doc.id}`) // open the new document, same as "New document"
    } catch (e) {
      setError(`Couldn't import "${file.name}": ${(e as Error).message}`)
      setBusy(null)
    }
  }

  return (
    <section
      className={`doc-list ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        // Ignore dragleave events fired when moving over child elements.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleImport(e.dataTransfer.files)
      }}
    >
      <div className="doc-list-header">
        <h1>My documents</h1>
        <div className="actions">
          <button onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            {busy === 'importing' ? 'Importing…' : '⬆ Import file'}
          </button>
          <button className="primary" onClick={handleCreate} disabled={busy !== null}>
            {busy === 'creating' ? 'Creating…' : '+ New document'}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={IMPORT_EXTENSIONS.join(',')}
          hidden
          data-testid="import-input"
          onChange={(e) => {
            handleImport(e.target.files)
            e.target.value = '' // allow re-selecting the same file after an error
          }}
        />
      </div>

      <p className="muted import-hint">
        Import a <strong>.txt</strong>, <strong>.md</strong> or <strong>.docx</strong> file (up to{' '}
        {MAX_IMPORT_MB} MB) to turn it into a new editable document. You can also drag and drop it here.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {docs === null && !error && <p className="muted">Loading…</p>}
      {docs?.length === 0 && <p className="muted">No documents yet. Create or import your first one!</p>}

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

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          Drop a .txt, .md or .docx file to import it
        </div>
      )}
    </section>
  )
}
