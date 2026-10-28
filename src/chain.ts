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
const RPC = 'https://rpc.nimiqwatch.com'
export async function jarBalanceNim(address: string) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountByAddress', params: [address] }) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message)
  return j.result.data.balance / LUNA
}
export async function nimNgn(): Promise<number> {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=ngn'); const j = await r.json(); return j.nimiq.ngn
}
export const validAddr = (a: string) => /^NQ\d{2}( ?[0-9A-Z]{4}){8}$/i.test(a.trim())
