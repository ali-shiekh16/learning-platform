import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // Forward API and socket traffic to Fastify so the browser sees a single origin.
    // Same origin means the session cookie just works, with no CORS configuration.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: false },
    },
  },
})
