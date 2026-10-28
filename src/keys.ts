// Browser-side Nimiq keypair generation (Ed25519 + Blake2b address), no WASM needed.
import { ed25519 } from '@noble/curves/ed25519'
import { blake2b } from '@noble/hashes/blake2b'
const ALPHA = '0123456789ABCDEFGHJKLMNPQRSTUVXY'
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map(x => parseInt(x, 16)))
function base32(b: Uint8Array) { let bits = 0, val = 0, out = ''; for (const x of b) { val = (val << 8) | x; bits += 8; while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5 } } if (bits) out += ALPHA[(val << (5 - bits)) & 31]; return out }
function ibanCheck(s: string) { const n = s.toUpperCase().split('').map(c => { const i = c.charCodeAt(0); return i >= 65 && i <= 90 ? String(i - 55) : c }).join(''); let r = 0; for (const d of n) r = (r * 10 + +d) % 97; return r }
export function addressFromPublicKey(pub: Uint8Array) {
  const raw = blake2b(pub, { dkLen: 32 }).slice(0, 20); const b = base32(raw)
  const check = String(98 - ibanCheck(b + 'NQ00')).padStart(2, '0')
  return ('NQ' + check + b).replace(/.{4}/g, '$& ').trim()
}
export function addressFromPrivateKey(privHex: string) { return addressFromPublicKey(ed25519.getPublicKey(unhex(privHex))) }
export function newPiggyKey() { const priv = ed25519.utils.randomPrivateKey(); return { privateKey: hex(priv), address: addressFromPublicKey(ed25519.getPublicKey(priv)) } }
