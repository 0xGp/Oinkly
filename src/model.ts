// Shared data model + reducer. Used by the browser (optimistic) and by /api (authoritative).
export type Quest = { id: string; title: string; emoji: string; coins: number; status: 'open' | 'done' | 'paid'; tx?: string }
export type Dream = { title: string; emoji: string; coins: number }
export type Spend = { id: string; what: string; coins: number; need: boolean; status: 'asked' | 'ok' | 'no' }
export type Break = { at: number; what: string; nim: number; to: 'grown-up' | 'shop'; tx: string }
export type Kid = {
  id: string; name: string; avatar: string; jar: string; custody: 'app-key' | 'pasted'
  token: string; linkTx?: string; linked?: boolean
  coins: number; seeds: number; lastBonus: number; lessons: string[]
  dream: Dream; quests: Quest[]; spends: Spend[]; breaks?: Break[]
}
export type Family = { parent: string; kids: Kid[]; log: string[]; updated: number }
export type KidView = Omit<Kid, 'token' | 'custody' | 'jar' | 'linkTx'>

export const LESSONS = [
  { id: 'save', at: 10, emoji: '🌱', title: 'Save before you spend', line: 'Put some coins in Piggy first, then spend what is left.' },
  { id: 'needs', at: 25, emoji: '🍎', title: 'Needs vs Wants', line: 'Needs keep you healthy and safe. Wants are fun extras.' },
  { id: 'wait', at: 50, emoji: '🌳', title: 'Money grows when you wait', line: "Patience Seeds grow into more coins when you don't spend." },
  { id: 'dream', at: 80, emoji: '🌈', title: 'Dreams need a plan', line: 'Small coins every week add up to big Dreams.' },
  { id: 'share', at: 120, emoji: '🤝', title: 'Sharing is caring', line: 'Giving a little helps others and makes you happy too.' },
]
export const WEEK = 7 * 864e5
export const uid = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('')
export const normAddr = (a: string) => a.replace(/\s/g, '').toUpperCase()

export type ParentOp =
  | { op: 'addKid'; kid: Kid }
  | { op: 'removeKid'; kidId: string }
  | { op: 'setLinked'; kidId: string; tx: string; linked: boolean }
  | { op: 'addQuest'; kidId: string; quest: Quest }
  | { op: 'paidQuest'; kidId: string; questId: string; tx: string }
  | { op: 'pocket'; kidId: string; coins: number; tx: string }
  | { op: 'spendDecision'; kidId: string; spendId: string; ok: boolean }
  | { op: 'setDream'; kidId: string; dream: Dream }
export type KidOp =
  | { op: 'questDone'; questId: string }
  | { op: 'ask'; spend: Spend }
  | { op: 'harvest' }
  | { op: 'broke'; brk: Break }

function lessons(k: Kid): Kid {
  const t = k.coins + k.seeds
  const add = LESSONS.filter(l => t >= l.at && !k.lessons.includes(l.id)).map(l => l.id)
  return add.length ? { ...k, lessons: [...k.lessons, ...add] } : k
}
const onKid = (f: Family, id: string, fn: (k: Kid) => Kid): Family => ({ ...f, updated: Date.now(), kids: f.kids.map(k => k.id === id ? lessons(fn(k)) : k) })

export function applyParent(f: Family, o: ParentOp): Family {
  switch (o.op) {
    case 'addKid': {
      // one child = one parent: refuse a piggy address already used by another child in this family
      if (f.kids.some(k => k.id === o.kid.id || normAddr(k.jar) === normAddr(o.kid.jar))) return f
      return { ...f, updated: Date.now(), kids: [...f.kids, o.kid] }
    }
    case 'removeKid': return { ...f, updated: Date.now(), kids: f.kids.filter(k => k.id !== o.kidId) }
    case 'setLinked': return onKid(f, o.kidId, k => ({ ...k, linkTx: o.tx, linked: o.linked }))
    case 'addQuest': return onKid(f, o.kidId, k => ({ ...k, quests: [...k.quests, o.quest] }))
    case 'paidQuest': return onKid(f, o.kidId, k => { const q = k.quests.find(x => x.id === o.questId); if (!q || q.status === 'paid') return k; return { ...k, coins: k.coins + q.coins, quests: k.quests.map(x => x.id === q.id ? { ...x, status: 'paid', tx: o.tx } : x) } })
    case 'pocket': return onKid(f, o.kidId, k => ({ ...k, coins: k.coins + o.coins }))
    case 'spendDecision': return onKid(f, o.kidId, k => { const s = k.spends.find(x => x.id === o.spendId); if (!s || s.status !== 'asked') return k; return { ...k, coins: o.ok ? Math.max(0, k.coins - s.coins) : k.coins, lastBonus: o.ok ? Date.now() : k.lastBonus, spends: k.spends.map(x => x.id === s.id ? { ...x, status: o.ok ? 'ok' : 'no' } : x) } })
    case 'setDream': return onKid(f, o.kidId, k => ({ ...k, dream: o.dream }))
  }
  return f
}
export function applyKid(f: Family, kidId: string, o: KidOp): Family {
  return onKid(f, kidId, k => {
    if (o.op === 'questDone') return { ...k, quests: k.quests.map(q => q.id === o.questId && q.status === 'open' ? { ...q, status: 'done' } : q) }
    if (o.op === 'ask') return k.spends.filter(s => s.status === 'asked').length >= 5 ? k : { ...k, spends: [...k.spends, { ...o.spend, status: 'asked' as const }].slice(-20) }
    if (o.op === 'harvest') { if (Date.now() - k.lastBonus < WEEK) return k; return { ...k, seeds: k.seeds + Math.max(1, Math.round(k.coins * 0.05)), lastBonus: Date.now() } }
    if (o.op === 'broke') { if (!/^[0-9a-f]{64}$/.test(o.brk.tx) || k.breaks?.some(b => b.tx === o.brk.tx)) return k; return { ...k, coins: 0, seeds: 0, lastBonus: Date.now(), breaks: [...(k.breaks || []), { ...o.brk, what: String(o.brk.what).slice(0, 60) }].slice(-10) } }
    return k
  })
}
export function kidView(k: Kid): KidView { const { token: _t, custody: _c, jar: _j, linkTx: _l, ...v } = k; return v }
