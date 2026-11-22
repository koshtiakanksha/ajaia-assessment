import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, Download, FilePlus2, Italic,
  Link2, ListChecks, Lock, Minus, Pencil, Printer, Quote, Redo2, RemoveFormatting, Share2,
  Strikethrough, TextSelect, Underline, Undo2, Upload,
} from 'lucide-react'
import { api, validateImportFile, IMPORT_EXTENSIONS, type Doc } from '../api'
import { pendingSave } from '../auth/context'
import { buildExtensions, LINE_SPACINGS } from '../editor/extensions'
import { useAutosave, type SaveStatus } from '../editor/useAutosave'
import Avatar from '../components/Avatar'
import MenuBar, { type Menu } from '../components/MenuBar'
import ShareDialog from '../components/ShareDialog'
import Toolbar from '../components/Toolbar'
import UserMenu from '../components/UserMenu'

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  pending: 'Saving…',
  saving: 'Saving…',
  offline: 'Offline. Retrying…',
  error: 'Changes not saved',
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
      <div className="message-page">
        <p className="error">{loadError ?? 'Invalid document id'}</p>
        <Link to="/">← Back to documents</Link>
      </div>
    )
  }
  if (!doc || doc.id !== docId) return <p className="muted center">Loading…</p>

  // key: remount a fresh editor when switching documents
  return <DocumentEditor key={doc.id} doc={doc} />
}

function DocumentEditor({ doc }: { doc: Doc }) {
  const navigate = useNavigate()
  const canEdit = doc.role !== 'viewer' // the backend enforces this too
  const isOwner = doc.role === 'owner'
  const [title, setTitle] = useState(doc.title)
  const savedTitle = useRef(doc.title)
  const titleInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [sharing, setSharing] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [showWordCount, setShowWordCount] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  // Refs so the (stable) autosave callback always sends the latest values.
  const editorRef = useRef<Editor | null>(null)
  const titleRef = useRef(title)
  useEffect(() => {
    titleRef.current = title
  }, [title])

  const { markDirty, flush, status, error, hasUnsavedChanges } = useAutosave(
    useCallback(async () => {
      const editor = editorRef.current
      if (!editor) return
      const t = titleRef.current.trim()
      const saved = await api.updateDocument(doc.id, {
        content: editor.getHTML(),
        ...(t ? { title: t } : {}), // an empty title isn't saved (it reverts on blur)
      })
      savedTitle.current = saved.title
    }, [doc.id]),
  )

  const editor = useEditor({
    extensions: buildExtensions(canEdit),
    content: doc.content,
    editable: canEdit,
    onUpdate: () => markDirty(),
  })
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  // Keyboard shortcuts: Ctrl/Cmd+S saves now, +K inserts a link, +\ clears formatting.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 's') {
        e.preventDefault()
        if (canEdit) void flush()
      } else if (e.key === 'k' && canEdit) {
        e.preventDefault()
        setLinkOpen(true)
      } else if (e.key === '\\' && canEdit) {
        e.preventDefault()
        editor.chain().focus().unsetAllMarks().clearNodes().run()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canEdit, editor, flush])

  // Warn before closing/reloading the tab while changes are unsaved...
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  // ...before signing out (AuthGate saves first)...
  useEffect(() => {
    pendingSave.current = hasUnsavedChanges ? flush : null
    return () => {
      pendingSave.current = null
    }
  }, [hasUnsavedChanges, flush])

  // ...and before in-app navigation: save first, and only ask if saving fails.
  const blocker = useBlocker(hasUnsavedChanges)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void flush().then((ok) => {
      if (ok || window.confirm('Your latest changes could not be saved. Leave anyway?')) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, flush])

  function commitTitle() {
    if (!title.trim()) setTitle(savedTitle.current) // like Docs: an empty title reverts
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    const problem = validateImportFile(file)
    if (problem) return setNotice(problem)
    try {
      const created = await api.importDocument(file)
      navigate(`/docs/${created.id}`)
    } catch (e) {
      setNotice(`Couldn't import "${file.name}": ${(e as Error).message}`)
    }
  }

  async function newDocument() {
    try {
      const created = await api.createDocument()
      navigate(`/docs/${created.id}`)
    } catch (e) {
      setNotice((e as Error).message)
    }
  }

  function download(kind: 'html' | 'txt') {
    const name = (title.trim() || 'document').replace(/[\\/:*?"<>|]+/g, '-')
    const body =
      kind === 'html'
        ? `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${editor.getHTML()}</body></html>`
        : editor.getText({ blockSeparator: '\n\n' })
    const url = URL.createObjectURL(new Blob([body], { type: kind === 'html' ? 'text/html' : 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.${kind}` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const openImport = useCallback(() => importInput.current?.click(), [])
  const rename = useCallback(() => titleInput.current?.select(), [])

  const menus = useDocumentMenus({
    editor, canEdit, isOwner, showWordCount, showToolbar,
    actions: {
      newDocument, download, setLinkOpen, setSharing, setShowWordCount, setShowToolbar,
      importFile: openImport,
      rename,
    },
  })

  const words = useEditorState({ editor, selector: ({ editor: e }) => e.storage.characterCount.words() as number })

  return (
    <div className="doc-shell">
      <header className="doc-header">
        <Link to="/" className="doc-home" title="Docs home">
          <img src="/brand/ajaia-mark.png" alt="Ajaia Docs home" width={36} height={36} />
        </Link>
        <div className="doc-header-main">
          <div className="doc-title-row">
            <input
              ref={titleInput}
              className="title-input"
              style={{ width: `${Math.min(Math.max(title.length, 16), 60) + 2}ch` }}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (e.target.value.trim()) markDirty()
              }}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && editor.commands.focus()}
              placeholder="Untitled document"
              aria-label="Document title"
              maxLength={200}
              readOnly={!canEdit}
            />
            {canEdit ? (
              <span className={`save-status ${status}`} role="status" title={error ?? undefined}>
                {STATUS_TEXT[status]}
              </span>
            ) : (
              <span className="badge badge-viewer">View only</span>
            )}
          </div>
          <MenuBar menus={menus} />
        </div>
        <div className="doc-header-actions">
          {!isOwner && (
            <span className="owned-by muted" title={doc.owner.email}>
              <Avatar user={doc.owner} size={22} /> Owned by {doc.owner.name}
            </span>
          )}
          {isOwner && (
            <button className="primary share-button" onClick={() => setSharing(true)}>
              <Lock size={16} /> Share
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      {canEdit && showToolbar && <Toolbar editor={editor} onLink={() => setLinkOpen(true)} />}
      {linkOpen && canEdit && <LinkBar editor={editor} onClose={() => setLinkOpen(false)} />}

      {((status === 'error' && error) || notice || !canEdit) && (
        <div className="doc-alerts">
          {status === 'error' && error && <p className="error">{error}</p>}
          {notice && (
            <p className="error">
              {notice} <button className="link-button" onClick={() => setNotice(null)}>Dismiss</button>
            </p>
          )}
          {!canEdit && <p className="notice">You have view-only access. Ask {doc.owner.name} for edit access.</p>}
        </div>
      )}

      <div className="canvas">
        <div className="page">
          <EditorContent editor={editor} className={`editor ${canEdit ? '' : 'readonly'}`} />
        </div>
      </div>

      {showWordCount && (
        <div className="word-count" role="status" aria-label="Word count">
          {words} {words === 1 ? 'word' : 'words'}
        </div>
      )}

      <input
        ref={importInput}
        type="file"
        hidden
        data-testid="editor-import-input"
        accept={IMPORT_EXTENSIONS.join(',')}
        onChange={(e) => {
          void importFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {sharing && <ShareDialog docId={doc.id} title={title} onClose={() => setSharing(false)} />}
    </div>
  )
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** Menu bar definitions (File, Edit, View, Insert, Format), rebuilt each render. */
function useDocumentMenus({ editor, canEdit, isOwner, showWordCount, showToolbar, actions }: {
  editor: Editor
  canEdit: boolean
  isOwner: boolean
  showWordCount: boolean
  showToolbar: boolean
  actions: {
    newDocument: () => void
    importFile: () => void
    download: (kind: 'html' | 'txt') => void
    rename: () => void
    setLinkOpen: (v: boolean) => void
    setSharing: (v: boolean) => void
    setShowWordCount: (v: boolean) => void
    setShowToolbar: (v: boolean) => void
  }
}): Menu[] {
  const chain = () => editor.chain().focus()
  const ro = !canEdit
  return [
    {
      label: 'File',
      items: [
        { label: 'New document', icon: <FilePlus2 size={16} />, onSelect: actions.newDocument },
        { label: 'Import file (.txt, .md, .docx)', icon: <Upload size={16} />, onSelect: actions.importFile },
        { separator: true },
        { label: 'Share', icon: <Share2 size={16} />, onSelect: () => actions.setSharing(true), disabled: !isOwner },
        { label: 'Rename', icon: <Pencil size={16} />, onSelect: actions.rename, disabled: ro },
        { separator: true },
        { label: 'Download as HTML (.html)', icon: <Download size={16} />, onSelect: () => actions.download('html') },
        { label: 'Download as plain text (.txt)', icon: <Download size={16} />, onSelect: () => actions.download('txt') },
        { label: 'Print', icon: <Printer size={16} />, shortcut: `${mod}P`, onSelect: () => window.print() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', icon: <Undo2 size={16} />, shortcut: `${mod}Z`, onSelect: () => chain().undo().run(), disabled: ro },
        { label: 'Redo', icon: <Redo2 size={16} />, shortcut: `${mod}Y`, onSelect: () => chain().redo().run(), disabled: ro },
        { separator: true },
        { label: 'Select all', icon: <TextSelect size={16} />, shortcut: `${mod}A`, onSelect: () => chain().selectAll().run() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Word count', checked: showWordCount, onSelect: () => actions.setShowWordCount(!showWordCount) },
        { label: 'Formatting toolbar', checked: showToolbar && canEdit, disabled: ro, onSelect: () => actions.setShowToolbar(!showToolbar) },
      ],
    },
    {
      label: 'Insert',
      items: [
        { label: 'Link', icon: <Link2 size={16} />, shortcut: `${mod}K`, onSelect: () => actions.setLinkOpen(true), disabled: ro },
        { label: 'Horizontal line', icon: <Minus size={16} />, onSelect: () => chain().setHorizontalRule().run(), disabled: ro },
        { label: 'Checklist', icon: <ListChecks size={16} />, onSelect: () => chain().toggleTaskList().run(), disabled: ro },
        { label: 'Quote', icon: <Quote size={16} />, onSelect: () => chain().toggleBlockquote().run(), disabled: ro },
        { label: 'Code block', icon: <Code size={16} />, onSelect: () => chain().toggleCodeBlock().run(), disabled: ro },
      ],
    },
    {
      label: 'Format',
      items: [
        { heading: 'Text' },
        { label: 'Bold', icon: <Bold size={16} />, shortcut: `${mod}B`, onSelect: () => chain().toggleBold().run(), disabled: ro },
        { label: 'Italic', icon: <Italic size={16} />, shortcut: `${mod}I`, onSelect: () => chain().toggleItalic().run(), disabled: ro },
        { label: 'Underline', icon: <Underline size={16} />, shortcut: `${mod}U`, onSelect: () => chain().toggleUnderline().run(), disabled: ro },
        { label: 'Strikethrough', icon: <Strikethrough size={16} />, onSelect: () => chain().toggleStrike().run(), disabled: ro },
        { separator: true },
        { heading: 'Paragraph styles' },
        { label: 'Normal text', onSelect: () => chain().setParagraph().run(), disabled: ro },
        { label: 'Heading 1', onSelect: () => chain().setHeading({ level: 1 }).run(), disabled: ro },
        { label: 'Heading 2', onSelect: () => chain().setHeading({ level: 2 }).run(), disabled: ro },
        { label: 'Heading 3', onSelect: () => chain().setHeading({ level: 3 }).run(), disabled: ro },
        { separator: true },
        { heading: 'Align' },
        { label: 'Left', icon: <AlignLeft size={16} />, onSelect: () => chain().setTextAlign('left').run(), disabled: ro },
        { label: 'Center', icon: <AlignCenter size={16} />, onSelect: () => chain().setTextAlign('center').run(), disabled: ro },
        { label: 'Right', icon: <AlignRight size={16} />, onSelect: () => chain().setTextAlign('right').run(), disabled: ro },
        { label: 'Justified', icon: <AlignJustify size={16} />, onSelect: () => chain().setTextAlign('justify').run(), disabled: ro },
        { separator: true },
        { heading: 'Line spacing' },
        ...LINE_SPACINGS.map((l) => ({
          label: l.label,
          onSelect: () => chain().setParagraphLineHeight(l.value).run(),
          disabled: ro,
        })),
        { separator: true },
        { label: 'Clear formatting', icon: <RemoveFormatting size={16} />, shortcut: `${mod}\\`, onSelect: () => chain().unsetAllMarks().clearNodes().run(), disabled: ro },
      ],
    },
  ]
}

/** Small bar under the toolbar for adding, editing or removing a link. */
function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  function apply() {
    const typed = url.trim()
    if (!typed) return remove()
    let href = typed
    if (!/^(https?:|mailto:)/i.test(href)) href = (href.includes('@') && !href.includes('/') ? 'mailto:' : 'https://') + href
    try {
      new URL(href)
    } catch {
      return setError('Enter a valid link, like example.com')
    }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: insert the link text itself.
      editor.chain().focus().insertContent({ type: 'text', text: typed, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    onClose()
  }

  return (
    <div className="link-bar" role="dialog" aria-label="Insert link">
      <Link2 size={16} />
      <input
        ref={input}
        value={url}
        placeholder="Paste or type a link"
        aria-label="Link URL"
        onChange={(e) => {
          setUrl(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply()
          if (e.key === 'Escape') {
            onClose()
            editor.commands.focus()
          }
        }}
      />
      <button className="primary" onClick={apply}>Apply</button>
      {editor.isActive('link') && <button onClick={remove}>Remove link</button>}
      <button className="link-button" onClick={onClose}>Cancel</button>
      {error && <span className="error inline">{error}</span>}
    </div>
  )
}
