import { Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { CharacterCount, Placeholder } from '@tiptap/extensions'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphLineHeight: {
      /** Line spacing for the selected paragraphs/headings, e.g. "1.5". */
      setParagraphLineHeight: (value: string | null) => ReturnType
    }
  }
}

const BLOCK_TYPES = ['paragraph', 'heading']

/** Paragraph-level line spacing (Docs' "Line & paragraph spacing"). */
const ParagraphLineHeight = Extension.create({
  name: 'paragraphLineHeight',
  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setParagraphLineHeight:
        (value) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (BLOCK_TYPES.includes(node.type.name)) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value })
            }
          })
          dispatch?.(tr)
          return true
        },
    }
  },
})

export function buildExtensions(editable: boolean) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: !editable, autolink: true, defaultProtocol: 'https' },
    }),
    // Font family, font size and text color (stored as inline styles).
    TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: BLOCK_TYPES }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ParagraphLineHeight,
    CharacterCount,
    Placeholder.configure({ placeholder: editable ? 'Start typing…' : '' }),
  ]
}

export const FONT_FAMILIES = [
  { label: 'Inter', value: '' }, // default (Ajaia's brand font)
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
]

export const DEFAULT_FONT_SIZE = 11 // pt, like Docs
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72]

export const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Ajaia navy', value: '#001d6b' },
  { name: 'Ajaia blue', value: '#1b3fa3' },
  { name: 'Sky', value: '#5e80c6' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#c0392b' },
  { name: 'Orange', value: '#d35400' },
  { name: 'Green', value: '#1e8449' },
  { name: 'Purple', value: '#7d3c98' },
]

export const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fff59d' },
  { name: 'Sky', value: '#c4dcfb' },
  { name: 'Green', value: '#c8e6c9' },
  { name: 'Pink', value: '#f8bbd0' },
  { name: 'Orange', value: '#ffe0b2' },
]

export const LINE_SPACINGS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
]
