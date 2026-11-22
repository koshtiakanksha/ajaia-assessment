export interface DocumentSummary {
  id: number
  title: string
  updated_at: string
}

export interface Doc extends DocumentSummary {
  content: string
  created_at: string
}

const OFFLINE_MESSAGE = "Can't reach the server. Check that it's running and try again."

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error(OFFLINE_MESSAGE) // network error: server down or no connection
  }
  // 502/503/504 come from the dev proxy (or a host) when the API is unreachable.
  if ([502, 503, 504].includes(res.status)) throw new Error(OFFLINE_MESSAGE)
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
  return res.json()
}

export const api = {
  listDocuments: () => request<DocumentSummary[]>('/documents'),
  getDocument: (id: number) => request<Doc>(`/documents/${id}`),
  createDocument: (title?: string) =>
    request<Doc>('/documents', { method: 'POST', body: JSON.stringify(title ? { title } : {}) }),
  updateDocument: (id: number, data: { title?: string; content?: string }) =>
    request<Doc>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}
