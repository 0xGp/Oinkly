import { createHash } from 'node:crypto'
import { store, storeKind } from './_store.js'
import { applyParent, normAddr, type Family, type ParentOp } from '../src/model.js'
const h = (s: string) => createHash('sha256').update(s).digest('hex')
type Rec = { secretHash: string; family: Family; jarIndex?: boolean }
const indexJar = (jar: string, parent: string, kidId: string) => store.write(`jar/${normAddr(jar)}`, { parent, kidId })
// GET  /api/family?parent=NQ..          header x-family-secret
// POST /api/family?parent=NQ..  {ops: ParentOp[]}   (first POST with a new secret claims the address)
export default async function handler(req: any, res: any) {
  const parent = normAddr(String(req.query.parent || ''))
  const secret = String(req.headers['x-family-secret'] || '')
  if (!/^NQ\d{2}[0-9A-Z]{32}$/.test(parent) || secret.length < 16) return res.status(400).json({ error: 'bad parent or secret' })
  const key = `family/${parent}`
  let rec = await store.read<Rec>(key)
  if (rec && rec.secretHash !== h(secret)) return res.status(403).json({ error: 'This Nimiq address is already registered from another device. Use the family recovery code.' })
  if (rec && !rec.jarIndex) {
    await Promise.all(rec.family.kids.map(k => indexJar(k.jar, parent, k.id)))
    rec = { ...rec, jarIndex: true }; await store.write(key, rec)
  }
  if (req.method === 'GET') return res.json({ storage: storeKind, family: rec?.family ?? null })
  if (req.method !== 'POST') return res.status(405).end()
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  let fam: Family = rec?.family ?? { parent, kids: [], log: [], updated: Date.now() }
  for (const o of (body.ops || []) as ParentOp[]) {
    if (o.op === 'addKid') {
      const idx = await store.read<{ parent: string }>(`token/${o.kid.token}`)
      if (idx && idx.parent !== parent) continue
      fam = applyParent(fam, o)
      if (fam.kids.some(k => k.id === o.kid.id)) await Promise.all([store.write(`token/${o.kid.token}`, { parent, kidId: o.kid.id }), indexJar(o.kid.jar, parent, o.kid.id)])
    } else fam = applyParent(fam, o)
  }
  if (body.log) fam = { ...fam, log: [String(body.log).slice(0, 140), ...fam.log].slice(0, 30) }
  await store.write(key, { secretHash: h(secret), family: fam, jarIndex: true })
  res.json({ storage: storeKind, family: fam })
}
