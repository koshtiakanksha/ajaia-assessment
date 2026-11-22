import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import DocumentList from './pages/DocumentList'
import DocumentEditor from './pages/DocumentEditor'

// A "data router" (vs <BrowserRouter>) is needed for useBlocker, which lets
// the editor warn before in-app navigation discards unsaved changes.
const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <DocumentList /> },
      { path: '/docs/:id', element: <DocumentEditor /> },
      { path: '*', element: <p className="error">Page not found.</p> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
