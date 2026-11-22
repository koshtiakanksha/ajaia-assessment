import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useDismiss } from './useDismiss'

export type MenuEntry =
  | { label: string; onSelect: () => void; shortcut?: string; icon?: ReactNode; disabled?: boolean; checked?: boolean }
  | { separator: true }
  | { heading: string }

export interface Menu {
  label: string
  items: MenuEntry[]
}

/** Google Docs-style menu bar: click to open; hover switches menus while one is open. */
export default function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(ref, open !== null, close)

  return (
    <div className="menubar" role="menubar" ref={ref}>
      {menus.map((menu) => (
        <div key={menu.label} className="menu-root">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === menu.label}
            className={open === menu.label ? 'open' : ''}
            onMouseDown={(e) => e.preventDefault()} // keep the editor selection
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <div className="menu" role="menu" aria-label={menu.label}>
              {menu.items.map((item, i) => {
                if ('separator' in item) return <div key={i} className="menu-sep" role="separator" />
                if ('heading' in item) return <div key={i} className="menu-heading">{item.heading}</div>
                return (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      close()
                      item.onSelect()
                    }}
                  >
                    <span className="menu-icon">{item.checked ? <Check size={16} /> : item.icon}</span>
                    <span className="menu-label">{item.label}</span>
                    {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
