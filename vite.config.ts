import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const hmrHost = process.env.VITE_HMR_HOST
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, hmr: hmrHost ? { host: hmrHost, protocol: 'ws', clientPort: 5173 } : undefined },
  preview: { host: true, port: 4173 },
})
