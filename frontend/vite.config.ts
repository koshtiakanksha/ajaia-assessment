import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, Vite serves the React app and forwards /api calls to FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8001',
    },
  },
})
