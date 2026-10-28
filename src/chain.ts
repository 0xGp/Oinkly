import { init, type NimiqProvider } from '@nimiq/mini-app-sdk'
export const LUNA = 100_000
export const NIM_PER_COIN = 10
let p: Promise<NimiqProvider> | null = null
export function getNimiq() { if (!p) p = init({ timeout: 8_000 }); return p }
export function errMsg(e: unknown): string {
  const a = e as { code?: number; message?: string }
  if (a?.code === 4001) return 'Cancelled in Nimiq Pay. Nothing was sent.'
  return a?.message || String(e)
}
export async function myAddress(): Promise<string> { const n = await getNimiq(); const a = await n.listAccounts(); return a[0] }
/** Real NIM payment via Nimiq Pay with a memo. coins -> NIM */
export async function payCoins(to: string, coins: number, memo: string) {
  const n = await getNimiq()
  const value = Math.round(coins * NIM_PER_COIN * LUNA)
  const r = await n.sendBasicTransactionWithData({ recipient: to, value, data: memo.slice(0, 64) })
  if (typeof r === 'object' && r && 'error' in (r as object)) throw new Error(String((r as any).error?.message || 'Payment failed'))
  return String(r)
}
export const RPC = 'https://rpc.nimiqwatch.com'
export async function jarBalanceNim(address: string) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountByAddress', params: [address] }) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message)
  return j.result.data.balance / LUNA
}
export async function nimNgn(): Promise<number> {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=ngn'); const j = await r.json(); return j.nimiq.ngn
}
export const validAddr = (a: string) => /^NQ\d{2}( ?[0-9A-Z]{4}){8}$/i.test(a.trim())

export async function parentAddress(): Promise<string> {
  const n = await getNimiq(); const a = await n.listAccounts()
  if (!Array.isArray(a) || !a.length) throw new Error('Nimiq Pay did not share an address')
  return a[0]
}
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  if (!r.ok) throw new Error(`Nimiq RPC unavailable (${r.status}). Try again in a minute.`)
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result.data as T
}
const txt = (h?: string) => { try { return new TextDecoder().decode(new Uint8Array((h || '').match(/../g)?.map(b => parseInt(b, 16)) || [])) } catch { return '' } }
const n = (a: string) => a.replace(/\s/g, '').toUpperCase()
export const linkMemo = (childId: string) => `Oinkly:link:${childId}`
/** The FIRST incoming "Oinkly:link:" tx to a child address decides its parent. Later links are ignored. */
export async function verifyLink(child: string, childId: string, parent: string) {
  type Tx = { hash: string; from: string; to: string; recipientData?: string; senderData?: string; data?: string; executionResult?: boolean; blockNumber?: number }
  const txs = await rpc<Tx[]>('getTransactionsByAddress', [n(child), 500])
  const links = txs.filter(t => n(t.to) === n(child) && t.executionResult !== false && txt(t.recipientData || t.data).startsWith('Oinkly:link:'))
    .sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0))
  const first = links[0]
  if (!first) return { ok: false, reason: 'No link payment found on-chain yet (it can take ~1 minute).' }
  const memo = txt(first.recipientData || first.data)
  if (n(first.from) !== n(parent)) return { ok: false, hash: first.hash, reason: 'This Piggy was already linked by another grown-up.' }
  if (memo !== linkMemo(childId)) return { ok: false, hash: first.hash, reason: 'This Piggy is linked to a different child.' }
  return { ok: true, hash: first.hash }
}
export async function payNim(to: string, nim: number, memo: string) {
  const nq = await getNimiq()
  const r = await nq.sendBasicTransactionWithData({ recipient: to, value: Math.round(nim * LUNA), data: memo.slice(0, 64) })
  if (typeof r !== 'string') throw new Error(String((r as any)?.error?.message || 'Payment failed'))
  return r
}
export const normAddr = (a: string) => a.replace(/\s/g, '').toUpperCase()
