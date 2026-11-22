import { useCallback, useEffect, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { api, type Doc } from '../api'
import Toolbar from '../components/Toolbar'
import ShareDialog from '../components/ShareDialog'
import Avatar from '../components/Avatar'
import { unsavedChanges } from '../auth/context'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const STATUS_TEXT: Record<SaveState, string> = {
  saved: 'All changes saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
}

/** Loads the document, then mounts the editor with its content. */
export default function DocumentEditorPage() {
  const docId = Number(useParams().id)
  const validId = Number.isSafeInteger(docId) && docId > 0
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!validId) return
    let cancelled = false // ignore responses for a document we've navigated away from
    api
      .getDocument(docId)
      .then((d) => !cancelled && setDoc(d))
      .catch((e) => !cancelled && setLoadError(e.message))
    return () => {
      cancelled = true
    }
  }, [docId, validId])

  if (loadError || !validId) {
    return (
      <section className="editor-page">
        <p className="error">{loadError ?? 'Invalid document id'}</p>
        <Link to="/">← Back to documents</Link>
      </section>
    )
  }
  if (!doc || doc.id !== docId) return <p className="muted">Loading…</p>

  // key: remount a fresh editor when switching documents
  return <DocumentEditor key={doc.id} doc={doc} />
}

function DocumentEditor({ doc }: { doc: Doc }) {
  const canEdit = doc.role !== 'viewer' // the backend enforces this too
  const isOwner = doc.role === 'owner'
  const [title, setTitle] = useState(doc.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // StarterKit (TipTap v3) includes bold, italic, underline, headings and lists.
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: doc.content,
    editable: canEdit,
    onUpdate: () => setSaveState('dirty'),
  })

  const save = useCallback(async () => {
    if (!canEdit) return
    setSaveState('saving')
    setSaveError(null)
    try {
      const saved = await api.updateDocument(doc.id, { title, content: editor.getHTML() })
      setTitle(saved.title)
      setSaveState('saved')
    } catch (e) {
      setSaveError((e as Error).message)
      setSaveState('error')
    }
  }, [canEdit, doc.id, editor, title])

  // Ctrl/Cmd+S saves instead of opening the browser's "save page" dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  const hasUnsavedChanges = saveState === 'dirty' || saveState === 'error'

  // Warn before closing/reloading the tab with unsaved changes...
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  // ...and before signing out...
  useEffect(() => {
    unsavedChanges.current = hasUnsavedChanges
    return () => {
      unsavedChanges.current = false
    }
  }, [hasUnsavedChanges])

  // ...and before in-app navigation (links, browser back/forward).
  const blocker = useBlocker(hasUnsavedChanges)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  return (
    <section className="editor-page">
      <div className="editor-header">
        <Link to="/" className="back">← Documents</Link>
        <input
          className="title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaveState('dirty')
          }}
          placeholder="Document title"
          aria-label="Document title"
          maxLength={200}
          readOnly={!canEdit}
        />
        {canEdit ? (
          <>
            <span className={`save-status ${saveState}`}>{STATUS_TEXT[saveState]}</span>
            <button onClick={save} disabled={saveState === 'saving' || saveState === 'saved'}>
              Save
            </button>
          </>
        ) : (
          <span className="badge badge-viewer">View only</span>
        )}
        {isOwner ? (
          <button className="primary" onClick={() => setSharing(true)}>Share</button>
        ) : (
          <span className="owned-by muted" title={doc.owner.email}>
            <Avatar user={doc.owner} size={20} /> Owned by {doc.owner.name}
          </span>
        )}
      </div>

      {saveError && <p className="error">{saveError}</p>}
      {!canEdit && (
        <p className="notice">You have view-only access. Ask {doc.owner.name} for edit access.</p>
      )}

      {canEdit && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className={`editor ${canEdit ? '' : 'readonly'}`} />

      {sharing && <ShareDialog docId={doc.id} title={title} onClose={() => setSharing(false)} />}
    </section>
  )
}
