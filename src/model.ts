// Shared data model + reducer. Used by the browser (optimistic) and by /api (authoritative).
export type Quest = { id: string; title: string; emoji: string; coins: number; status: 'open' | 'done' | 'paid'; tx?: string; paidAt?: number }
export type Dream = { title: string; emoji: string; coins: number }
export type Spend = { id: string; what: string; coins: number; need: boolean; status: 'asked' | 'ok' | 'no' | 'spent'; tx?: string }
export type Earned = { emoji: string; title: string; coins: number }
/** A Piggy payment for an approved spend; `earned` is the receipt's list of quests paid since the last break. */
export type Break = { at: number; what: string; nim: number; to: 'grown-up' | 'shop'; tx: string; spendId?: string; coins?: number; need?: boolean; earned?: Earned[] }
export type Gift = { at: number; coins: number; tx: string }
/** A request to turn saver points into coins; the grown-up pays the NIM. */
export type CashIn = { id: string; points: number; at: number; status: 'asked' | 'paid' | 'no'; tx?: string }
export type Kid = {
  id: string; name: string; avatar: string; jar: string; custody: 'app-key' | 'pasted'
  token: string; linkTx?: string; linked?: boolean
  /** `lessons` holds every badge id earned, money lessons and saver badges alike. */
  coins: number; seeds: number; lastBonus: number; lessons: string[]
  dream: Dream; quests: Quest[]; spends: Spend[]; breaks?: Break[]; gifts?: Gift[]
  /** `lifetimePoints` never goes down, so name tags stay earned after cashing in. */
  points?: number; lifetimePoints?: number; savedSince?: number; lastCollect?: number; cashes?: CashIn[]
}
export type Family = { parent: string; kids: Kid[]; log: string[]; updated: number }
export type KidView = Omit<Kid, 'token' | 'custody' | 'jar' | 'linkTx'>

export const LESSONS = [
  { id: 'save', at: 10, emoji: '🌱', title: 'Save before you spend', line: 'Put some coins in Piggy first, then spend what is left.' },
  { id: 'needs', at: 25, emoji: '🍎', title: 'Needs vs Wants', line: 'Needs keep you healthy and safe. Wants are fun extras.' },
  { id: 'wait', at: 50, emoji: '🌳', title: 'Money grows when you wait', line: 'Saver points grow every day you keep your coins in Piggy.' },
  { id: 'dream', at: 80, emoji: '🌈', title: 'Dreams need a plan', line: 'Small coins every week add up to big Dreams.' },
  { id: 'share', at: 120, emoji: '🤝', title: 'Sharing is caring', line: 'Giving a little helps others and makes you happy too.' },
]
export const DAY = 864e5
export const WEEK = 7 * DAY
export const POINTS_PER_QUEST = 5
export const POINTS_PER_COIN = 10

export const TAGS = [
  { at: 0, emoji: '🐣', title: 'Piggy Starter' },
  { at: 25, emoji: '🪙', title: 'Coin Keeper' },
  { at: 75, emoji: '🧠', title: 'Smart Saver' },
  { at: 150, emoji: '🦸', title: 'Super Saver' },
  { at: 300, emoji: '👑', title: 'Money Master' },
]
type Saver = Pick<Kid, 'coins' | 'quests' | 'breaks' | 'lastBonus'> & Partial<Pick<Kid, 'points' | 'lifetimePoints' | 'savedSince' | 'lastCollect' | 'cashes'>>
export const streakDays = (k: Saver) => Math.max(0, Math.floor((Date.now() - (k.savedSince ?? k.lastBonus)) / DAY))
export function nameTag(k: Saver) {
  const p = k.lifetimePoints ?? 0
  const i = TAGS.findLastIndex(t => p >= t.at)
  return { ...TAGS[i], next: TAGS[i + 1] as (typeof TAGS)[number] | undefined, points: p }
}
/** Daily points for keeping coins in the Piggy; doubles after a week without breaking it. */
export const collectPoints = (k: Saver) => k.coins < 1 ? 0 : Math.max(1, Math.round(k.coins / 20)) * (streakDays(k) >= 7 ? 2 : 1)
export const canCollect = (k: Saver) => collectPoints(k) > 0 && Date.now() - (k.lastCollect ?? 0) >= DAY
export const freePoints = (k: Saver) => (k.points ?? 0) - (k.cashes || []).filter(c => c.status === 'asked').reduce((t, c) => t + c.points, 0)
export const SAVER_BADGES: { id: string; emoji: string; title: string; line: string; need: string; test: (k: Saver) => boolean }[] = [
  { id: 'quest1', emoji: '⚔️', title: 'Quest hero', line: 'You earned your first coins by doing a quest.', need: 'Finish your first quest', test: k => k.quests.some(q => q.status === 'paid') },
  { id: 'streak3', emoji: '🔥', title: '3-day saver', line: 'Three days without breaking your Piggy!', need: 'Save for 3 days in a row', test: k => streakDays(k) >= 3 },
  { id: 'streak7', emoji: '🗓️', title: 'Week saver', line: 'A whole week of saving. Your points now grow 2×!', need: 'Save for 7 days in a row', test: k => streakDays(k) >= 7 },
  { id: 'points50', emoji: '⭐', title: 'Point collector', line: 'Points grow when you save instead of spend.', need: 'Earn 50 saver points', test: k => (k.lifetimePoints ?? 0) >= 50 },
  { id: 'cashin', emoji: '💱', title: 'Points to NIM', line: 'You turned saving into real NIM.', need: 'Cash in saver points', test: k => !!k.cashes?.some(c => c.status === 'paid') },
  { id: 'streak30', emoji: '🌳', title: 'Patient Piggy', line: 'A month of saving. That is real patience!', need: 'Save for 30 days in a row', test: k => streakDays(k) >= 30 },
]
export const coinsText = (n: number) => `${n} coin${n === 1 ? '' : 's'}`
export const badgeTitle = (id: string) => [...LESSONS, ...SAVER_BADGES].find(b => b.id === id)?.title
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
  | { op: 'cashPaid'; kidId: string; cashId: string; tx: string }
  | { op: 'cashNo'; kidId: string; cashId: string }
export type KidOp =
  | { op: 'questDone'; questId: string }
  | { op: 'ask'; spend: Spend }
  | { op: 'harvest' }
  | { op: 'broke'; brk: Break }
  | { op: 'cashIn'; id: string; points: number }

function lessons(k: Kid): Kid {
  const t = k.coins + k.seeds
  const add = [...LESSONS.filter(l => t >= l.at), ...SAVER_BADGES.filter(b => b.test(k))].map(b => b.id).filter(id => !k.lessons.includes(id))
  return add.length ? { ...k, lessons: [...k.lessons, ...add] } : k
}
const addPoints = (k: Kid, n: number): Kid => ({ ...k, points: (k.points ?? 0) + n, lifetimePoints: (k.lifetimePoints ?? 0) + n })
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
    case 'paidQuest': return onKid(f, o.kidId, k => { const q = k.quests.find(x => x.id === o.questId); if (!q || q.status === 'paid') return k; return addPoints({ ...k, coins: k.coins + q.coins, quests: k.quests.map(x => x.id === q.id ? { ...x, status: 'paid', tx: o.tx, paidAt: Date.now() } : x) }, POINTS_PER_QUEST) })
    case 'pocket': return onKid(f, o.kidId, k => k.gifts?.some(g => g.tx === o.tx) ? k : ({ ...k, coins: k.coins + o.coins, gifts: [...(k.gifts || []), { at: Date.now(), coins: o.coins, tx: o.tx }].slice(-10) }))
    // Approval only unlocks the spend; coins leave when the kid breaks the bank for it.
    case 'spendDecision': return onKid(f, o.kidId, k => { const s = k.spends.find(x => x.id === o.spendId); if (!s || s.status !== 'asked') return k; return { ...k, spends: k.spends.map(x => x.id === s.id ? { ...x, status: o.ok ? 'ok' : 'no' } : x) } })
    case 'setDream': return onKid(f, o.kidId, k => ({ ...k, dream: o.dream }))
    case 'cashPaid': return onKid(f, o.kidId, k => {
      const c = k.cashes?.find(x => x.id === o.cashId); if (!c || c.status !== 'asked') return k
      return { ...k, points: Math.max(0, (k.points ?? 0) - c.points), coins: k.coins + c.points / POINTS_PER_COIN, cashes: k.cashes!.map(x => x.id === c.id ? { ...x, status: 'paid' as const, tx: o.tx } : x) }
    })
    case 'cashNo': return onKid(f, o.kidId, k => ({ ...k, cashes: k.cashes?.map(x => x.id === o.cashId && x.status === 'asked' ? { ...x, status: 'no' as const } : x) }))
  }
  return f
}
export function applyKid(f: Family, kidId: string, o: KidOp): Family {
  return onKid(f, kidId, k => {
    if (o.op === 'questDone') return { ...k, quests: k.quests.map(q => q.id === o.questId && q.status === 'open' ? { ...q, status: 'done' } : q) }
    if (o.op === 'ask') return k.spends.filter(s => s.status === 'asked').length >= 5 ? k : { ...k, spends: [...k.spends, { ...o.spend, status: 'asked' as const }].slice(-20) }
    if (o.op === 'harvest') return canCollect(k) ? { ...addPoints(k, collectPoints(k)), lastCollect: Date.now() } : k
    if (o.op === 'cashIn') {
      const p = Math.floor(Number(o.points))
      if (!(p >= POINTS_PER_COIN) || p % POINTS_PER_COIN || p > freePoints(k) || k.cashes?.some(c => c.id === o.id)) return k
      return { ...k, cashes: [...(k.cashes || []), { id: String(o.id).slice(0, 16), points: p, at: Date.now(), status: 'asked' as const }].slice(-10) }
    }
    if (o.op === 'broke') {
      const s = k.spends.find(x => x.id === o.brk.spendId)
      if (!/^[0-9a-f]{64}$/.test(o.brk.tx) || !s || s.status !== 'ok' || k.breaks?.some(b => b.tx === o.brk.tx)) return k
      const since = k.breaks?.at(-1)?.at ?? 0
      const earned = k.quests.filter(q => q.status === 'paid' && (q.paidAt ?? 0) > since).slice(-10).map(({ emoji, title, coins }) => ({ emoji, title, coins }))
      const brk: Break = { at: Date.now(), what: s.what, coins: s.coins, need: s.need, nim: Number(o.brk.nim) || 0, to: 'grown-up', tx: o.brk.tx, spendId: s.id, earned }
      return { ...k, coins: Math.max(0, k.coins - s.coins), lastBonus: Date.now(), savedSince: Date.now(), spends: k.spends.map(x => x.id === s.id ? { ...x, status: 'spent', tx: o.brk.tx } : x), breaks: [...(k.breaks || []), brk].slice(-10) }
    }
    return k
  })
}
export function kidView(k: Kid): KidView { const { token: _t, custody: _c, jar: _j, linkTx: _l, ...v } = k; return v }
