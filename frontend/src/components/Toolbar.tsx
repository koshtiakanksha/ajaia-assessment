import { type Editor, useEditorState } from '@tiptap/react'

interface ButtonDef {
  label: string
  title: string
  isActive: (e: Editor) => boolean
  run: (e: Editor) => void
}

const BUTTONS: ButtonDef[] = [
  { label: 'B', title: 'Bold (Ctrl/Cmd+B)', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: 'Italic (Ctrl/Cmd+I)', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: 'Underline (Ctrl/Cmd+U)', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'H1', title: 'Heading 1', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: 'Heading 2', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'Heading 3', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '• List', title: 'Bulleted list', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1. List', title: 'Numbered list', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
]

export default function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the set of active formats changes.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => BUTTONS.map((b) => b.isActive(editor)),
  })

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {BUTTONS.map((b, i) => (
        <button
          key={b.label}
          type="button"
          title={b.title}
          aria-pressed={active[i]}
          className={active[i] ? 'active' : ''}
          // Keep focus (and the text selection) in the editor when clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => b.run(editor)}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
