import { useRef, useState, type ReactNode } from 'react'
import { type Editor, useEditorState } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Highlighter, IndentDecrease,
  IndentIncrease, Italic, Link2, List, ListChecks, ListOrdered, Minus, Plus, Printer, Redo2,
  RemoveFormatting, Strikethrough, Underline, Undo2,
} from 'lucide-react'
import {
  DEFAULT_FONT_SIZE, FONT_FAMILIES, HIGHLIGHT_COLORS, LINE_SPACINGS, TEXT_COLORS,
} from '../editor/extensions'
import { useDismiss } from './useDismiss'

const keep = (e: React.MouseEvent) => e.preventDefault() // keep focus/selection in the editor

function Btn({ label, active, disabled, onClick, children }: {
  label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={keep}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="tb-sep" aria-hidden="true" />

// Default size of each paragraph style in pt (matches index.css), like Docs shows.
const BLOCK_SIZES: Record<string, number> = { h1: 20, h2: 16, h3: 13, p: DEFAULT_FONT_SIZE }

function blockOf(editor: Editor): string {
  for (const level of [1, 2, 3]) if (editor.isActive('heading', { level })) return `h${level}`
  return 'p'
}

function currentFontSize(editor: Editor): number {
  const size = editor.getAttributes('textStyle').fontSize as string | undefined
  const n = size ? parseFloat(size) : NaN
  return Number.isFinite(n) ? n : BLOCK_SIZES[blockOf(editor)]
}

function applyFontSize(editor: Editor, size: number) {
  const clamped = Math.min(400, Math.max(1, Math.round(size)))
  if (clamped === BLOCK_SIZES[blockOf(editor)]) editor.chain().focus().unsetFontSize().run()
  else editor.chain().focus().setFontSize(`${clamped}pt`).run()
}

/** Normalize CSS font-family strings so stored values match the dropdown options. */
const normFont = (v: string | undefined) => (v ?? '').replace(/\s*,\s*/g, ', ').replace(/'/g, '"')

export default function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      block: blockOf(e),
      font: normFont(e.getAttributes('textStyle').fontFamily),
      size: currentFontSize(e),
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'),
      strike: e.isActive('strike'), link: e.isActive('link'),
      color: (e.getAttributes('textStyle').color as string) ?? '',
      highlight: (e.getAttributes('highlight').color as string) ?? '',
      align: (['center', 'right', 'justify'].find((a) => e.isActive({ textAlign: a })) ?? 'left'),
      lineHeight: (e.getAttributes('paragraph').lineHeight ?? e.getAttributes('heading').lineHeight ?? '') as string,
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      canSink: e.can().sinkListItem('listItem') || e.can().sinkListItem('taskItem'),
      canLift: e.can().liftListItem('listItem') || e.can().liftListItem('taskItem'),
    }),
  })
  const [sizeDraft, setSizeDraft] = useState<string | null>(null)
  // Focus synchronously first (TipTap's focus() waits a frame; see the size box below).
  const chain = () => {
    editor.view.focus()
    return editor.chain().focus()
  }
  const commitSize = () => {
    if (sizeDraft) applyFontSize(editor, Number(sizeDraft))
    setSizeDraft(null)
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}><Undo2 size={18} /></Btn>
      <Btn label="Redo (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}><Redo2 size={18} /></Btn>
      <Btn label="Print (Ctrl+P)" onClick={() => window.print()}><Printer size={18} /></Btn>
      <Sep />

      <select
        className="tb-select style-select"
        aria-label="Paragraph style"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'p') chain().setParagraph().run()
          else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
        }}
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Sep />

      <select
        className="tb-select font-select"
        aria-label="Font"
        value={FONT_FAMILIES.some((f) => f.value === s.font) ? s.font : ''}
        onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value} style={{ fontFamily: f.value || 'Inter' }}>{f.label}</option>
        ))}
      </select>
      <Sep />

      <Btn label="Decrease font size" onClick={() => applyFontSize(editor, s.size - 1)}><Minus size={16} /></Btn>
      <input
        className="tb-size"
        aria-label="Font size"
        inputMode="numeric"
        value={sizeDraft ?? String(s.size)}
        onChange={(e) => setSizeDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitSize()
            // Move focus back synchronously: TipTap's focus() waits a frame, and
            // fast typing in between would otherwise land in this box.
            editor.view.focus()
          } else if (e.key === 'Escape') {
            setSizeDraft(null)
            editor.view.focus()
          }
        }}
        onBlur={commitSize}
      />
      <Btn label="Increase font size" onClick={() => applyFontSize(editor, s.size + 1)}><Plus size={16} /></Btn>
      <Sep />

      <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><Bold size={18} /></Btn>
      <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><Italic size={18} /></Btn>
      <Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}><Underline size={18} /></Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={18} /></Btn>
      <ColorPicker
        label="Text color"
        icon={<Baseline size={18} />}
        current={s.color}
        colors={TEXT_COLORS}
        onPick={(c) => (c ? chain().setColor(c).run() : chain().unsetColor().run())}
      />
      <ColorPicker
        label="Highlight color"
        icon={<Highlighter size={18} />}
        current={s.highlight}
        colors={HIGHLIGHT_COLORS}
        onPick={(c) => (c ? chain().setHighlight({ color: c }).run() : chain().unsetHighlight().run())}
      />
      <Sep />

      <Btn label="Insert link (Ctrl+K)" active={s.link} onClick={onLink}><Link2 size={18} /></Btn>
      <Sep />

      <Btn label="Left align" active={s.align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={18} /></Btn>
      <Btn label="Center align" active={s.align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={18} /></Btn>
      <Btn label="Right align" active={s.align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={18} /></Btn>
      <Btn label="Justify" active={s.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={18} /></Btn>
      <select
        className="tb-select spacing-select"
        aria-label="Line spacing"
        value={s.lineHeight}
        onChange={(e) => chain().setParagraphLineHeight(e.target.value || null).run()}
      >
        <option value="">Spacing</option>
        {LINE_SPACINGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <Sep />

      <Btn label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}><ListChecks size={18} /></Btn>
      <Btn label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}><List size={18} /></Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={18} /></Btn>
      <Btn
        label="Decrease indent"
        disabled={!s.canLift}
        onClick={() => (editor.can().liftListItem('taskItem') ? chain().liftListItem('taskItem').run() : chain().liftListItem('listItem').run())}
      >
        <IndentDecrease size={18} />
      </Btn>
      <Btn
        label="Increase indent"
        disabled={!s.canSink}
        onClick={() => (editor.can().sinkListItem('taskItem') ? chain().sinkListItem('taskItem').run() : chain().sinkListItem('listItem').run())}
      >
        <IndentIncrease size={18} />
      </Btn>
      <Btn label="Clear formatting (Ctrl+\)" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting size={18} />
      </Btn>
    </div>
  )
}

function ColorPicker({ label, icon, current, colors, onPick }: {
  label: string; icon: ReactNode; current: string; colors: { name: string; value: string }[]; onPick: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  return (
    <span className="color-picker" ref={ref}>
      <button
        type="button"
        className="tb-btn"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={keep}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="color-bar" style={{ background: current || 'transparent' }} />
      </button>
      {open && (
        <div className="color-menu" role="menu" aria-label={label}>
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              role="menuitem"
              title={c.name}
              aria-label={`${label}: ${c.name}`}
              className={`swatch ${c.value === current ? 'selected' : ''} ${c.value ? '' : 'none'}`}
              style={{ background: c.value || undefined }}
              onMouseDown={keep}
              onClick={() => {
                onPick(c.value)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </span>
  )
}
