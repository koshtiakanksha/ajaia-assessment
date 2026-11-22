import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { api, isValidEmail, type ShareRole, type SharingInfo, type User } from '../api'
import { useAuth } from '../auth/context'
import Avatar from './Avatar'

interface Props {
  docId: number
  title: string
  onClose: () => void
}

/** Google Docs-style share dialog: add people by email, change roles, remove access. */
export default function ShareDialog({ docId, title, onClose }: Props) {
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState<SharingInfo | null>(null)
  const [knownUsers, setKnownUsers] = useState<User[]>([])
  const [emails, setEmails] = useState<string[]>([]) // pending "chips"
  const [draft, setDraft] = useState('')
  const [role, setRole] = useState<ShareRole>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.getShares(docId).then(setInfo).catch((e) => setError(e.message))
    api.knownUsers().then(setKnownUsers).catch(() => {}) // suggestions are optional
    input.current?.focus()
  }, [docId])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Turn typed/pasted text into chips. Returns false if something was invalid. */
  function addEmails(text: string): boolean {
    const parts = text.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
    const invalid = parts.filter((p) => !isValidEmail(p))
    const valid = parts.filter((p) => isValidEmail(p))
    if (valid.length) setEmails((prev) => [...new Set([...prev, ...valid])])
    if (invalid.length) {
      setError(`"${invalid[0]}" isn't a valid email address.`)
      setDraft(invalid.join(' '))
      return false
    }
    setDraft('')
    setError(null)
    return true
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) {
      e.preventDefault()
      addEmails(draft)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      share()
    } else if (e.key === 'Backspace' && !draft && emails.length) {
      setEmails(emails.slice(0, -1))
    }
  }

  async function run(action: () => Promise<SharingInfo>, success?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      setInfo(await action())
      if (success) setNotice(success)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    // Include whatever is still typed in the box.
    const pending = draft.trim() ? draft.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean) : []
    if (pending.length && !addEmails(draft)) return
    const all = [...new Set([...emails, ...pending])]
    if (!all.length) return setError('Add at least one email address.')
    const ok = await run(
      () => api.addShares(docId, all, role),
      `Shared with ${all.length === 1 ? all[0] : `${all.length} people`} as ${role}.`,
    )
    if (ok) setEmails([])
  }

  const sharedEmails = new Set(info?.shares.map((s) => s.email))
  const suggestions = knownUsers.filter((u) => !sharedEmails.has(u.email) && !emails.includes(u.email))

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share “{title}”</h2>

        <div className="share-add">
          <div className="chip-input" onClick={() => input.current?.focus()}>
            {emails.map((email) => (
              <span key={email} className="chip">
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  onClick={() => setEmails(emails.filter((x) => x !== email))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={input}
              value={draft}
              list="share-suggestions"
              placeholder={emails.length ? '' : 'Add people by email'}
              aria-label="Add people by email"
              onChange={(e) => {
                // Picking a suggestion from the dropdown (a "replacement", not typing)
                // or pasting several addresses turns the text into chips.
                const v = e.target.value
                const native = e.nativeEvent as InputEvent
                const pickedSuggestion = !native.inputType || native.inputType === 'insertReplacementText'
                if (/[\s,;]/.test(v.trim()) || pickedSuggestion) addEmails(v)
                else setDraft(v)
              }}
              onKeyDown={onKeyDown}
              onBlur={() => draft.trim() && addEmails(draft)}
            />
            <datalist id="share-suggestions">
              {suggestions.map((u) => (
                <option key={u.id} value={u.email}>{u.name}</option>
              ))}
            </datalist>
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="primary" onClick={share} disabled={busy || (!emails.length && !draft.trim())}>
            Share
          </button>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        <h3>People with access</h3>
        {!info ? (
          <p className="muted">Loading…</p>
        ) : (
          <ul className="people">
            <li>
              <Avatar user={info.owner} />
              <span className="person">
                <strong>{info.owner.name}{info.owner.id === user.id && ' (you)'}</strong>
                <span className="muted">{info.owner.email}</span>
              </span>
              <span className="muted role-label">Owner</span>
            </li>
            {info.shares.map((s) => (
              <li key={s.id}>
                <Avatar user={s} />
                <span className="person">
                  <strong>{s.name ?? s.email}</strong>
                  <span className="muted">{s.name ? s.email : 'Hasn’t signed in yet'}</span>
                </span>
                <select
                  value={s.role}
                  aria-label={`Access for ${s.email}`}
                  disabled={busy}
                  onChange={(e) =>
                    run(() => api.updateShare(docId, s.id, e.target.value as ShareRole), `${s.email} is now ${e.target.value === 'editor' ? 'an editor' : 'a viewer'}.`)
                  }
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  className="link-button danger"
                  aria-label={`Remove access for ${s.email}`}
                  disabled={busy}
                  onClick={() => run(() => api.revokeShare(docId, s.id), `Removed access for ${s.email}.`)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-footer">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
