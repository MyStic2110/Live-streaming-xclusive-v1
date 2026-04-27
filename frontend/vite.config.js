import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Direct Local Proxy to LiveKit
      '/livekit': {
        target: 'ws://127.0.0.1:7880',
        ws: true,
        rewrite: (path) => path.replace(/^\/livekit/, '')
      },
      // Direct Local Proxy to Backend
      '/go-live': 'http://127.0.0.1:3002',
      '/request-call': 'http://127.0.0.1:3002',
      '/end-room': 'http://127.0.0.1:3002',
      '/socket.io': {
        target: 'http://127.0.0.1:3002',
        ws: true
      }
    }
  }
})
