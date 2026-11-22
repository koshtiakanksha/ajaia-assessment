import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus, Upload } from 'lucide-react'
import { api, IMPORT_EXTENSIONS, MAX_IMPORT_MB, validateImportFile, type DocumentSummary } from '../api'
import Avatar from '../components/Avatar'

/** Docs home: start a new document, then "My documents" and "Shared with me". */
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

  // Shared by the "Import file" tile and drag-and-drop.
  async function handleImport(files: FileList | null) {
    if (!files || files.length === 0 || busy) return
    if (files.length > 1) return setError('Please import one file at a time.')
    const file = files[0]
    const problem = validateImportFile(file)
    if (problem) return setError(problem)
    setBusy('importing')
    setError(null)
    try {
      const doc = await api.importDocument(file)
      navigate(`/docs/${doc.id}`) // open the new document, same as "Blank document"
    } catch (e) {
      setError(`Couldn't import "${file.name}": ${(e as Error).message}`)
      setBusy(null)
    }
  }

  return (
    <div
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
      <section className="start-band" aria-label="Start a new document">
        <div className="start-inner">
          <h1>Start a new document</h1>
          <div className="start-tiles">
            <button className="tile" onClick={handleCreate} disabled={busy !== null} aria-label="Blank document">
              <span className="tile-preview"><Plus size={56} strokeWidth={1.25} /></span>
              <span className="tile-label">{busy === 'creating' ? 'Creating…' : 'Blank document'}</span>
            </button>
            <button
              className="tile"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== null}
              aria-label="Import file"
            >
              <span className="tile-preview import"><Upload size={40} strokeWidth={1.5} /></span>
              <span className="tile-label">{busy === 'importing' ? 'Importing…' : 'Import file'}</span>
            </button>
          </div>
          <p className="muted import-hint">
            Import a <strong>.txt</strong>, <strong>.md</strong> or <strong>.docx</strong> file (up to {MAX_IMPORT_MB} MB)
            to turn it into a new editable document. You can also drag and drop it anywhere on this page.
          </p>
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
      </section>

      <section className="docs-area">
        <h1 className="sr-only">Documents</h1>
        {error && <p className="error" role="alert">{error}</p>}
        {docs === null && !error && <p className="muted">Loading…</p>}
        {docs && (
          <>
            <DocSection
              title="My documents"
              docs={docs.filter((d) => d.role === 'owner')}
              empty="No documents yet. Create or import your first one!"
            />
            <DocSection
              title="Shared with me"
              docs={docs.filter((d) => d.role !== 'owner')}
              empty="Nothing has been shared with you yet."
              shared
            />
          </>
        )}
      </section>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <Upload size={28} /> Drop a .txt, .md or .docx file to import it
        </div>
      )}
    </div>
  )
}

function formatModified(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) })
}

function DocSection({ title, docs, empty, shared = false }: {
  title: string
  docs: DocumentSummary[]
  empty: string
  shared?: boolean
}) {
  return (
    <div className="doc-section" aria-label={title} role="region">
      <div className="doc-section-head">
        <h2>{title} <span className="count">{docs.length}</span></h2>
        {docs.length > 0 && (
          <div className="col-heads" aria-hidden="true">
            <span>{shared ? 'Owner' : ''}</span>
            <span>Last modified</span>
          </div>
        )}
      </div>
      {docs.length === 0 ? (
        <p className="muted empty">{empty}</p>
      ) : (
        <ul>
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link to={`/docs/${doc.id}`}>
                <FileText className="doc-icon" size={20} aria-hidden="true" />
                <span className="doc-title">{doc.title}</span>
                {shared && <RoleBadge role={doc.role} />}
                <span className="owner" title={doc.owner.email}>
                  {shared ? (
                    <>
                      <Avatar user={doc.owner} size={20} /> {doc.owner.name}
                    </>
                  ) : (
                    'me'
                  )}
                </span>
                <span className="muted modified" title={new Date(doc.updated_at).toLocaleString()}>
                  {formatModified(doc.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: DocumentSummary['role'] }) {
  return <span className={`badge badge-${role}`}>{role === 'editor' ? 'Can edit' : 'View only'}</span>
}
