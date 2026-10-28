// Pluggable storage: Vercel Blob (private) when BLOB_READ_WRITE_TOKEN is set, otherwise in-memory (dev/demo only).
import { put, get } from '@vercel/blob'
export interface Store { read<T>(key: string): Promise<T | null>; write(key: string, v: unknown): Promise<void> }
const mem = new Map<string, string>()
const memory: Store = { async read(k) { const v = mem.get(k); return v ? JSON.parse(v) : null }, async write(k, v) { mem.set(k, JSON.stringify(v)) } }
const blob: Store = {
  async read<T>(k: string) {
    try { const r = await get(`oinkly/${k}.json`, { access: 'private', useCache: false } as any); if (!r || (r as any).statusCode !== 200) return null; return JSON.parse(await new Response((r as any).stream).text()) as T }
    catch (e: any) { if (/not.?found/i.test(String(e?.name) + String(e?.message))) return null; throw e }
  },
  async write(k, v) { await put(`oinkly/${k}.json`, JSON.stringify(v), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 } as any) },
}
export const store: Store = process.env.BLOB_READ_WRITE_TOKEN ? blob : memory
export const storeKind = process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'memory'
