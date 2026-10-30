// Browser-side Nimiq keys and transactions (Ed25519 + Blake2b), no WASM needed.
// Byte layouts match @nimiq/core 2.x (Albatross) serializeContent()/serialize().
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
const ALPHA = '0123456789ABCDEFGHJKLMNPQRSTUVXY'
export const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
export const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map(x => parseInt(x, 16)))
function base32(b: Uint8Array) { let bits = 0, val = 0, out = ''; for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5 } } if (bits) out += ALPHA[(val << (5 - bits)) & 31]; return out }
function unbase32(s: string) { const out: number[] = []; let bits = 0, val = 0; for (const c of s) { val = (val << 5) | ALPHA.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8 } } return Uint8Array.from(out) }
function ibanCheck(s: string) { const n = s.toUpperCase().split('').map(c => { const i = c.charCodeAt(0); return i >= 65 && i <= 90 ? String(i - 55) : c }).join(''); let r = 0; for (const d of n) r = (r * 10 + +d) % 97; return r }
export function addressFromPublicKey(pub: Uint8Array) {
  const raw = blake2b(pub, { dkLen: 32 }).slice(0, 20); const b = base32(raw)
  const check = String(98 - ibanCheck(b + 'NQ00')).padStart(2, '0')
  return ('NQ' + check + b).replace(/.{4}/g, '$& ').trim()
}
export function addressFromPrivateKey(privHex: string) { return addressFromPublicKey(ed25519.getPublicKey(unhex(privHex))) }
export function newPiggyKey() { const priv = ed25519.utils.randomPrivateKey(); return { privateKey: hex(priv), address: addressFromPublicKey(ed25519.getPublicKey(priv)) } }
export const cleanKey = (k: string) => k.replace(/\s/g, '').toLowerCase()
export const validKey = (k: string) => /^[0-9a-f]{64}$/.test(cleanKey(k))

export const loginMessage = (ts: number) => new TextEncoder().encode(`Oinkly login ${ts}`)
export function signLogin(privHex: string) {
  const priv = unhex(cleanKey(privHex)), ts = Date.now()
  return { pub: hex(ed25519.getPublicKey(priv)), sig: hex(ed25519.sign(loginMessage(ts), priv)), ts }
}

const be = (n: bigint, len: number) => { const b = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { b[i] = Number(n & 0xffn); n >>= 8n } return b }
const cat = (...parts: (Uint8Array | number[])[]) => { const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length } return out }
const addrBytes = (a: string) => unbase32(a.replace(/\s/g, '').toUpperCase().slice(4))
/** Signed basic payment from a Piggy key. With a memo it becomes an extended transaction. */
export function signPayment(privHex: string, to: string, luna: bigint, fee: bigint, validityStartHeight: number, networkId: number, memo = '') {
  const priv = unhex(cleanKey(privHex)), pub = ed25519.getPublicKey(priv)
  const sender = addrBytes(addressFromPublicKey(pub)), recipient = addrBytes(to)
  const data = new TextEncoder().encode(memo).slice(0, 64)
  const tail = cat(be(luna, 8), be(fee, 8), be(BigInt(validityStartHeight), 4), [networkId])
  const content = cat(be(BigInt(data.length), 2), data, sender, [0], recipient, [0], tail, [0], [0])
  const sig = ed25519.sign(content, priv)
  const tx = data.length
    ? cat([1], sender, [0, 0], recipient, [0, data.length], data, tail, [0], [98, 0], pub, [0], sig)
    : cat([0, 0], pub, recipient, tail, sig)
  return { hex: hex(tx), hash: hex(blake2b(content, { dkLen: 32 })) }
}
