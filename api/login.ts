import { ed25519 } from '@noble/curves/ed25519'
import { store } from './_store.js'
import { addressFromPublicKey, loginMessage, unhex } from '../src/keys.js'
import { normAddr, type Family } from '../src/model.js'
// POST /api/login {pub, sig, ts}: a kid proves they hold their Piggy key (the key never leaves the phone).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end()
  const { pub, sig, ts } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {}
  if (!/^[0-9a-f]{64}$/.test(pub) || !/^[0-9a-f]{128}$/.test(sig) || typeof ts !== 'number') return res.status(400).json({ error: 'That key looks wrong' })
  if (Math.abs(Date.now() - ts) > 5 * 60_000) return res.status(400).json({ error: "Your phone's clock looks wrong. Fix it and try again." })
  if (!ed25519.verify(unhex(sig), loginMessage(ts), unhex(pub))) return res.status(401).json({ error: 'That key looks wrong' })
  const jar = normAddr(addressFromPublicKey(unhex(pub)))
  const idx = await store.read<{ parent: string; kidId: string }>(`jar/${jar}`)
  const rec = idx && await store.read<{ family: Family }>(`family/${idx.parent}`)
  const kid = rec?.family.kids.find(k => k.id === idx!.kidId && normAddr(k.jar) === jar)
  if (!kid) return res.status(404).json({ error: "This key isn't a Piggy yet. Ask your grown-up to open Oinkly once, then try again." })
  res.json({ token: kid.token, name: kid.name })
}
