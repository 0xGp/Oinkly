import { store, storeKind } from './_store.js'
import { applyKid, kidView, type Family, type KidOp } from '../src/model.js'
// GET /api/kid?t=TOKEN -> only this child's view.  POST {op} -> kid actions (I did it, ask, harvest)
export default async function handler(req: any, res: any) {
  const t = String(req.query.t || '')
  const idx = t.length >= 16 ? await store.read<{ parent: string; kidId: string }>(`token/${t}`) : null
  if (!idx) return res.status(404).json({ error: 'Unknown piggy link' })
  const key = `family/${idx.parent}`
  const rec = await store.read<{ secretHash: string; family: Family }>(key)
  const kid = rec?.family.kids.find(k => k.id === idx.kidId && k.token === t)
  if (!rec || !kid) return res.status(404).json({ error: 'Piggy not found' })
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    rec.family = applyKid(rec.family, kid.id, body as KidOp)
    await store.write(key, rec)
  }
  res.json({ storage: storeKind, kid: kidView(rec.family.kids.find(k => k.id === kid.id)!) })
}
