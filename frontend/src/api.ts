export interface DocumentSummary {
  id: number
  title: string
  updated_at: string
}

export interface Doc extends DocumentSummary {
  content: string
  created_at: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
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
