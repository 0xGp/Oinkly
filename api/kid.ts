import { store, storeKind } from './_store.js'
import { applyKid, kidView, type Family, type KidOp } from '../src/model.js'
// GET /api/kid?t=TOKEN -> only this child's view.  POST {op} -> kid actions (I did it, ask, harvest, broke)
export default async function handler(req: any, res: any) {
  const t = String(req.query.t || '')
  const idx = t.length >= 16 ? await store.read<{ parent: string; kidId: string }>(`token/${t}`) : null
  if (!idx) return res.status(404).json({ error: 'Unknown piggy link' })
  const key = `family/${idx.parent}`
  const rec = await store.read<{ secretHash: string; family: Family }>(key)
  const kid = rec?.family.kids.find(k => k.id === idx.kidId && k.token === t)
  if (!rec || !kid) return res.status(404).json({ error: 'Piggy not found' })
  if (req.method === 'POST') {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as KidOp
    const before = rec.family.kids.find(k => k.id === kid.id)!.breaks?.length ?? 0
    rec.family = applyKid(rec.family, kid.id, body)
    const after = rec.family.kids.find(k => k.id === kid.id)!.breaks || []
    if (body.op === 'broke' && after.length !== before) {
      const b = after[after.length - 1]
      rec.family.log = [`${new Date(b.at).toLocaleString()} 🔨 ${kid.name} broke the bank: ${b.nim} NIM to ${b.to === 'shop' ? 'a shop' : 'you'} for "${b.what}" · ${b.tx.slice(0, 10)}…`, ...rec.family.log].slice(0, 30)
    }
    await store.write(key, rec)
  }
  res.json({ storage: storeKind, parent: rec.family.parent, kid: kidView(rec.family.kids.find(k => k.id === kid.id)!) })
}
