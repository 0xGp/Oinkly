import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
const hmrHost = process.env.VITE_HMR_HOST

// Runs api/*.ts like Vercel functions during `vite dev`, so /api works on localhost.
function vercelApi(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const m = url.pathname.match(/^\/api\/([a-z]+)$/)
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          let raw = ''
          for await (const c of req) raw += c
          const r = req as any, s = res as any
          r.query = Object.fromEntries(url.searchParams)
          r.body = raw ? JSON.parse(raw) : undefined
          s.status = (code: number) => { res.statusCode = code; return s }
          s.json = (v: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(v)) }
          await mod.default(r, s)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String((e as Error).message || e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), vercelApi()],
  server: { host: true, port: 5173, hmr: hmrHost ? { host: hmrHost, protocol: 'ws', clientPort: 5173 } : undefined },
  preview: { host: true, port: 4173 },
})
