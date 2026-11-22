import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { api, type Doc } from '../api'
import Toolbar from '../components/Toolbar'

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
  const validId = Number.isInteger(docId) && docId > 0
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
  const [title, setTitle] = useState(doc.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)

  // StarterKit (TipTap v3) includes bold, italic, underline, headings and lists.
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: doc.content,
    onUpdate: () => setSaveState('dirty'),
  })

  const save = useCallback(async () => {
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
  }, [doc.id, editor, title])

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

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (saveState !== 'dirty' && saveState !== 'error') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveState])

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
        />
        <span className={`save-status ${saveState}`}>{STATUS_TEXT[saveState]}</span>
        <button
          className="primary"
          onClick={save}
          disabled={saveState === 'saving' || saveState === 'saved'}
        >
          Save
        </button>
      </div>

      {saveError && <p className="error">{saveError}</p>}

      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="editor" />
    </section>
  )
}
