// Keep in sync with backend/app/importers.py
export const IMPORT_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx']
export const MAX_IMPORT_MB = 5

/** Client-side pre-check for instant feedback; the server re-validates. */
export function validateImportFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    return `"${file.name}" isn't supported. You can import .txt, .md or .docx files.`
  }
  if (file.size > MAX_IMPORT_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_IMPORT_MB} MB.`
  if (file.size === 0) return `"${file.name}" is empty.`
  return null
}

export interface User {
  id: number
  email: string
  name: string
}

export type ShareRole = 'viewer' | 'editor'
export type AccessRole = 'owner' | ShareRole

export interface DocumentSummary {
  id: number
  title: string
  updated_at: string
  role: AccessRole // the signed-in user's access
  owner: User
}

export interface Share {
  id: number
  email: string
  role: ShareRole
  name: string | null // set once that email has signed in
}

export interface SharingInfo {
  owner: User
  shares: Share[]
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim())

/** Fired when the session is missing or expired; AuthProvider shows sign-in. */
export const AUTH_EXPIRED_EVENT = 'auth:expired'

export interface Doc extends DocumentSummary {
  content: string
  created_at: string
}

const OFFLINE_MESSAGE = "Can't reach the server. Check that it's running and try again."

function offlineError(): Error {
  return Object.assign(new Error(OFFLINE_MESSAGE), { retryable: true })
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    // JSON bodies need a Content-Type; FormData (file uploads) sets its own.
    const isJson = typeof options.body === 'string'
    res = await fetch(`/api${path}`, {
      ...options,
      headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw offlineError() // network error: server down or no connection
  }
  // 502/503/504 come from the dev proxy (or a host) when the API is unreachable.
  if ([502, 503, 504].includes(res.status)) throw offlineError()
  if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  if (!res.ok) {
    // FastAPI returns { detail: string } for HTTP errors and
    // { detail: [{ msg }] } for validation errors.
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join(', ')
      : detail || `Request failed (${res.status})`
    throw new Error(message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })

export const api = {
  // Auth (simulated: no passwords)
  me: () => request<User>('/auth/me'),
  demoUsers: () => request<User[]>('/auth/demo-users'),
  login: (email: string) => request<User>('/auth/login', json('POST', { email })),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  knownUsers: () => request<User[]>('/users'),

  // Sharing (owner only)
  getShares: (docId: number) => request<SharingInfo>(`/documents/${docId}/shares`),
  addShares: (docId: number, emails: string[], role: ShareRole) =>
    request<SharingInfo>(`/documents/${docId}/shares`, json('POST', { emails, role })),
  updateShare: (docId: number, shareId: number, role: ShareRole) =>
    request<SharingInfo>(`/documents/${docId}/shares/${shareId}`, json('PATCH', { role })),
  revokeShare: (docId: number, shareId: number) =>
    request<SharingInfo>(`/documents/${docId}/shares/${shareId}`, { method: 'DELETE' }),

  // Documents
  listDocuments: () => request<DocumentSummary[]>('/documents'),
  getDocument: (id: number) => request<Doc>(`/documents/${id}`),
  createDocument: (title?: string) =>
    request<Doc>('/documents', { method: 'POST', body: JSON.stringify(title ? { title } : {}) }),
  importDocument: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Doc>('/documents/import', { method: 'POST', body: form })
  },
  updateDocument: (id: number, data: { title?: string; content?: string }) =>
    request<Doc>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}
