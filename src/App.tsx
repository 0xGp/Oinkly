import { useEffect, useState } from 'react'
import * as C from './chain'

type Quest = { id: string; title: string; emoji: string; coins: number; status: 'open' | 'done' | 'paid' }
type Dream = { title: string; emoji: string; coins: number }
type Spend = { id: string; what: string; coins: number; need: boolean; status: 'asked' | 'ok' | 'no' }
type Kid = { id: string; name: string; avatar: string; jar: string; coins: number; seeds: number; dream: Dream; quests: Quest[]; spends: Spend[]; lastBonus: number; lessons: string[] }
type State = { pin: string; kids: Kid[]; active: string; log: string[] }

const LESSONS = [
  { id: 'save', at: 10, emoji: '🌱', title: 'Save before you spend', line: 'Put some coins in Piggy first, then spend what is left.' },
  { id: 'needs', at: 25, emoji: '🍎', title: 'Needs vs Wants', line: 'Needs keep you healthy and safe. Wants are fun extras.' },
  { id: 'wait', at: 50, emoji: '🌳', title: 'Money grows when you wait', line: 'Patience Seeds grow into more coins when you don\'t spend.' },
  { id: 'dream', at: 80, emoji: '🌈', title: 'Dreams need a plan', line: 'Small coins every week add up to big Dreams.' },
  { id: 'share', at: 120, emoji: '🤝', title: 'Sharing is caring', line: 'Giving a little helps others and makes you happy too.' },
]
const uid = () => Math.random().toString(36).slice(2, 9)
const demoKid = (name: string, avatar: string): Kid => ({
  id: uid(), name, avatar, jar: '', coins: 12, seeds: 0, lastBonus: Date.now(), lessons: ['save'],
  dream: { title: 'New bicycle', emoji: '🚲', coins: 100 },
  quests: [
    { id: uid(), title: 'Make my bed', emoji: '🛏️', coins: 2, status: 'open' },
    { id: uid(), title: 'Read a book', emoji: '📚', coins: 3, status: 'open' },
    { id: uid(), title: 'Wash the dishes', emoji: '🍽️', coins: 4, status: 'done' },
  ], spends: [],
})
const KEY = 'oinkly-v1'
function load(): State {
  try { const s = JSON.parse(localStorage.getItem(KEY) || ''); if (s?.kids) return s } catch { /* */ }
  const k = demoKid('Ada', '🦁'); return { pin: '1234', kids: [k, demoKid('Tobi', '🐼')], active: k.id, log: [] }
}

let actx: AudioContext | null = null
function clink() {
  try {
    actx ??= new AudioContext()
    ;[1320, 1760, 2093].forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain(), t = actx!.currentTime + i * 0.09
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      o.connect(g).connect(actx!.destination); o.start(t); o.stop(t + 0.3)
    })
  } catch { /* */ }
}

export default function App() {
  const [s, setS] = useState<State>(load)
  const [mode, setMode] = useState<'kid' | 'lessons' | 'pin' | 'parent'>(() => (location.hash.slice(1) as any) || 'kid')
  const [drop, setDrop] = useState(0)
  const [toast, setToast] = useState('')
  const [ngn, setNgn] = useState<number | null>(null)
  const [chainBal, setChainBal] = useState<number | null>(null)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)) }, [s])
  useEffect(() => { C.nimNgn().then(setNgn).catch(() => setNgn(null)) }, [])
  const kid = s.kids.find(k => k.id === s.active) || s.kids[0]
  useEffect(() => { setChainBal(null); if (kid && C.validAddr(kid.jar)) C.jarBalanceNim(kid.jar).then(setChainBal).catch(() => {}) }, [kid?.jar])
  const upd = (f: (k: Kid) => Kid) => setS(p => ({ ...p, kids: p.kids.map(k => k.id === kid.id ? checkLessons(f(k)) : k) }))
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const naira = (c: number) => ngn ? `≈ ₦${Math.round(c * C.NIM_PER_COIN * ngn).toLocaleString()}` : ''
  function checkLessons(k: Kid): Kid {
    const total = k.coins + k.seeds
    const got = LESSONS.filter(l => total >= l.at && !k.lessons.includes(l.id)).map(l => l.id)
    if (got.length) setTimeout(() => say(`🏅 New badge: ${LESSONS.find(l => l.id === got[0])!.title}!`), 900)
    return got.length ? { ...k, lessons: [...k.lessons, ...got] } : k
  }
  function coinDrop() { setDrop(d => d + 1); clink() }

  // weekly patience bonus: 5% of untouched coins as Patience Seeds
  const week = 7 * 864e5
  const bonusReady = Date.now() - kid.lastBonus >= week
  const bonusAmt = Math.max(1, Math.round(kid.coins * 0.05))

  if (!kid) return null
  const pct = Math.min(100, Math.round(((kid.coins + kid.seeds) / kid.dream.coins) * 100))
  const level = kid.lessons.length

  return <div className="app">
    {toast && <div className="toast" role="status">{toast}</div>}
    <header>
      <div className="brand">🐷 Oinkly</div>
      <nav>
        <button className={mode === 'kid' ? 'on' : ''} onClick={() => setMode('kid')}>Piggy</button>
        <button className={mode === 'lessons' ? 'on' : ''} onClick={() => setMode('lessons')}>Badges</button>
        <button className={mode === 'parent' || mode === 'pin' ? 'on' : ''} onClick={() => setMode('pin')}>🔒 Parent</button>
      </nav>
    </header>

    {(mode === 'kid' || mode === 'lessons') && <div className="kids">{s.kids.map(k =>
      <button key={k.id} className={'kidchip ' + (k.id === kid.id ? 'on' : '')} onClick={() => setS({ ...s, active: k.id })}>{k.avatar} {k.name}</button>)}</div>}

    {mode === 'kid' && <main>
      <section className="piggy card">
        <div className="jar" onClick={coinDrop} aria-label="Piggy jar">
          <div className="pig bounce" key={drop}>🐷</div>
          {drop > 0 && <div className="coin fall" key={'c' + drop}>🪙</div>}
        </div>
        <div className="big">{kid.coins} <span>coins</span></div>
        <div className="muted">+ {kid.seeds} 🌱 Patience Seeds · {naira(kid.coins + kid.seeds)}</div>
        <div className="level">⭐ Level {level}</div>
      </section>

      <section className="card dream">
        <h2>My Dream {kid.dream.emoji}</h2>
        <div className="dreamrow"><div className="dreamimg" style={{ filter: `grayscale(${100 - pct}%)` }}>{kid.dream.emoji}</div>
          <div style={{ flex: 1 }}><b>{kid.dream.title}</b>
            <div className="bar"><div style={{ width: pct + '%' }} /></div>
            <small>{kid.coins + kid.seeds} / {kid.dream.coins} coins · {pct}%</small></div></div>
      </section>

      <section className="card">
        <h2>Quests ⚔️</h2>
        {kid.quests.filter(q => q.status !== 'paid').map(q => <div className="quest" key={q.id}>
          <span className="qe">{q.emoji}</span><div style={{ flex: 1 }}><b>{q.title}</b><small> +{q.coins} coins</small></div>
          {q.status === 'open' ? <button className="go" onClick={() => { upd(k => ({ ...k, quests: k.quests.map(x => x.id === q.id ? { ...x, status: 'done' } : x) })); say('🎉 Great job! Waiting for a grown-up to check.') }}>I did it!</button>
            : <span className="wait">⏳ Waiting</span>}
        </div>)}
        {!kid.quests.some(q => q.status !== 'paid') && <p className="muted">All quests done! 🏆</p>}
      </section>

      <section className="card">
        <h2>Patience Seeds 🌱</h2>
        <p className="muted">Don't spend for a week and Piggy grows {bonusAmt} extra coin{bonusAmt > 1 ? 's' : ''}! That is called <b>interest</b>.</p>
        <button className="go wide" disabled={!bonusReady} onClick={() => { upd(k => ({ ...k, seeds: k.seeds + bonusAmt, lastBonus: Date.now() })); coinDrop(); say(`🌱 Your patience grew ${bonusAmt} seeds!`) }}>
          {bonusReady ? `Harvest ${bonusAmt} seeds 🌻` : `Growing… ${Math.ceil((week - (Date.now() - kid.lastBonus)) / 864e5)} days left`}</button>
      </section>

      <AskSpend kid={kid} onAsk={(what, coins, need) => { upd(k => ({ ...k, spends: [...k.spends, { id: uid(), what, coins, need, status: 'asked' }] })); say('📨 Sent to your grown-up!') }} />
      {kid.spends.slice(-3).reverse().map(sp => <div key={sp.id} className="muted center">{sp.what} ({sp.coins}) — {sp.status === 'asked' ? '⏳ asked' : sp.status === 'ok' ? '✅ yes!' : '🙅 not now'}</div>)}
    </main>}

    {mode === 'lessons' && <main>
      <section className="card"><h2>Money Badges 🏅</h2><p className="muted">Grow your Piggy to unlock wisdom!</p>
        {LESSONS.map(l => { const on = kid.lessons.includes(l.id); return <div key={l.id} className={'badge ' + (on ? 'got' : 'locked')}>
          <div className="be">{on ? l.emoji : '🔒'}</div><div><b>{l.title}</b><div className="muted">{on ? l.line : `Unlocks at ${l.at} coins`}</div></div></div> })}
      </section></main>}

    {mode === 'pin' && <Pin pin={s.pin} ok={() => setMode('parent')} />}
    {mode === 'parent' && <Parent s={s} setS={setS} kid={kid} say={say} coinDrop={coinDrop} naira={naira} chainBal={chainBal} />}
    <footer>1 coin = {C.NIM_PER_COIN} NIM · parents pay real NIM via Nimiq Pay</footer>
  </div>
}

function AskSpend({ kid, onAsk }: { kid: Kid; onAsk: (w: string, c: number, n: boolean) => void }) {
  const [what, setWhat] = useState(''); const [c, setC] = useState(3); const [need, setNeed] = useState<boolean | null>(null)
  return <section className="card"><h2>Ask to spend 🛍️</h2>
    <input placeholder="What do you want?" value={what} onChange={e => setWhat(e.target.value)} />
    <div className="row">{[1, 3, 5, 10].map(v => <button key={v} className={'pill ' + (c === v ? 'on' : '')} onClick={() => setC(v)}>{v} 🪙</button>)}</div>
    <p className="muted">Is it a <b>Need</b> or a <b>Want</b>?</p>
    <div className="row"><button className={'pill ' + (need === true ? 'on' : '')} onClick={() => setNeed(true)}>🍎 Need</button><button className={'pill ' + (need === false ? 'on' : '')} onClick={() => setNeed(false)}>🎮 Want</button></div>
    <button className="go wide" disabled={!what || need === null || c > kid.coins} onClick={() => { onAsk(what, c, !!need); setWhat(''); setNeed(null) }}>{c > kid.coins ? 'Not enough coins yet' : 'Ask my grown-up'}</button>
  </section>
}

function Pin({ pin, ok }: { pin: string; ok: () => void }) {
  const [v, setV] = useState('')
  useEffect(() => { if (v.length === 4) { if (v === pin) ok(); else setTimeout(() => setV(''), 300) } }, [v])
  return <main><section className="card center"><h2>Grown-ups only 🔒</h2><p className="muted">Enter PIN (demo: 1234)</p>
    <div className="dots">{[0, 1, 2, 3].map(i => <span key={i} className={i < v.length ? 'f' : ''} />)}</div>
    <div className="pad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((d, i) => <button key={i} disabled={d === ''} onClick={() => setV(x => d === '⌫' ? x.slice(0, -1) : (x + d).slice(0, 4))}>{d}</button>)}</div>
  </section></main>
}

function Parent({ s, setS, kid, say, coinDrop, naira, chainBal }: { s: State; setS: (f: (p: State) => State) => void; kid: Kid; say: (m: string) => void; coinDrop: () => void; naira: (c: number) => string; chainBal: number | null }) {
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState({ title: '', emoji: '🧹', coins: 2 })
  const [nk, setNk] = useState({ name: '', avatar: '🐯' })
  const [pocket, setPocket] = useState(5)
  const upd = (id: string, f: (k: Kid) => Kid) => setS(p => ({ ...p, kids: p.kids.map(k => k.id === id ? f(k) : k) }))
  async function pay(k: Kid, coins: number, memo: string, after: () => void) {
    if (!C.validAddr(k.jar)) { say(`Add ${k.name}'s Piggy address (NQ…) first`); return }
    setBusy(memo)
    try { const h = await C.payCoins(k.jar, coins, memo); after(); coinDrop(); say(`✅ Sent ${coins * C.NIM_PER_COIN} NIM · ${memo}`); setS(p => ({ ...p, log: [`${new Date().toLocaleString()} ${k.name}: ${memo} (${h.slice(0, 10)}…)`, ...p.log].slice(0, 20) })) }
    catch (e) { say('⚠️ ' + C.errMsg(e) + (String(e).includes('timed out') || String(e).includes('Timeout') ? ' — open Oinkly inside Nimiq Pay' : '')) }
    finally { setBusy('') }
  }
  return <main>
    <section className="card"><h2>Grown-up corner 👨‍👩‍👧</h2>
      <div className="kids">{s.kids.map(k => <button key={k.id} className={'kidchip ' + (k.id === kid.id ? 'on' : '')} onClick={() => setS(p => ({ ...p, active: k.id }))}>{k.avatar} {k.name}</button>)}</div>
      <label>{kid.name}'s Piggy address (Nimiq)</label>
      <input placeholder="NQ.. .... ...." value={kid.jar} onChange={e => upd(kid.id, k => ({ ...k, jar: e.target.value.toUpperCase() }))} />
      <button className="pill" onClick={async () => { try { const a = await C.myAddress(); upd(kid.id, k => ({ ...k, jar: a })) } catch (e) { say(C.errMsg(e)) } }}>Use an address from my Nimiq Pay</button>
      <small className="muted">{C.validAddr(kid.jar) ? (chainBal == null ? 'Reading balance on-chain…' : `On-chain Piggy: ${chainBal.toFixed(2)} NIM`) : 'Not set yet'}</small>
    </section>

    <section className="card"><h2>Approve quests ✅</h2>
      {kid.quests.filter(x => x.status === 'done').map(x => <div className="quest" key={x.id}><span className="qe">{x.emoji}</span><div style={{ flex: 1 }}><b>{x.title}</b><small> {x.coins} coins = {x.coins * C.NIM_PER_COIN} NIM {naira(x.coins)}</small></div>
        <button className="go" disabled={!!busy} onClick={() => pay(kid, x.coins, `Quest: ${x.title}`, () => upd(kid.id, k => ({ ...k, coins: k.coins + x.coins, quests: k.quests.map(y => y.id === x.id ? { ...y, status: 'paid' } : y) })))}>{busy === `Quest: ${x.title}` ? '…' : 'Pay'}</button></div>)}
      {!kid.quests.some(x => x.status === 'done') && <p className="muted">Nothing to approve.</p>}
    </section>

    <section className="card"><h2>Spend requests 🛍️</h2>
      {kid.spends.filter(x => x.status === 'asked').map(x => <div className="quest" key={x.id}><div style={{ flex: 1 }}><b>{x.what}</b><small> {x.coins} coins · {x.need ? 'Need' : 'Want'}</small></div>
        <button className="go" onClick={() => upd(kid.id, k => ({ ...k, coins: Math.max(0, k.coins - x.coins), lastBonus: Date.now(), spends: k.spends.map(y => y.id === x.id ? { ...y, status: 'ok' } : y) }))}>Yes</button>
        <button className="pill" onClick={() => upd(kid.id, k => ({ ...k, spends: k.spends.map(y => y.id === x.id ? { ...y, status: 'no' } : y) }))}>Not now</button></div>)}
      {!kid.spends.some(x => x.status === 'asked') && <p className="muted">No requests.</p>}
    </section>

    <section className="card"><h2>Pocket money 💸</h2>
      <div className="row">{[2, 5, 10, 20].map(v => <button key={v} className={'pill ' + (pocket === v ? 'on' : '')} onClick={() => setPocket(v)}>{v} 🪙</button>)}</div>
      <button className="go wide" disabled={!!busy} onClick={() => pay(kid, pocket, 'Pocket money', () => upd(kid.id, k => ({ ...k, coins: k.coins + pocket })))}>Send {pocket} coins ({pocket * C.NIM_PER_COIN} NIM) {naira(pocket)}</button>
    </section>

    <section className="card"><h2>New quest ⚔️</h2>
      <div className="row"><input style={{ width: 60 }} value={q.emoji} onChange={e => setQ({ ...q, emoji: e.target.value })} /><input placeholder="e.g. Tidy toys" value={q.title} onChange={e => setQ({ ...q, title: e.target.value })} /></div>
      <div className="row">{[1, 2, 3, 5].map(v => <button key={v} className={'pill ' + (q.coins === v ? 'on' : '')} onClick={() => setQ({ ...q, coins: v })}>{v} 🪙</button>)}</div>
      <button className="go wide" disabled={!q.title} onClick={() => { upd(kid.id, k => ({ ...k, quests: [...k.quests, { id: uid(), ...q, status: 'open' }] })); setQ({ ...q, title: '' }) }}>Add quest for {kid.name}</button>
    </section>

    <section className="card"><h2>Dream 🌈</h2>
      <div className="row"><input style={{ width: 60 }} value={kid.dream.emoji} onChange={e => upd(kid.id, k => ({ ...k, dream: { ...k.dream, emoji: e.target.value } }))} />
        <input value={kid.dream.title} onChange={e => upd(kid.id, k => ({ ...k, dream: { ...k.dream, title: e.target.value } }))} />
        <input style={{ width: 80 }} type="number" value={kid.dream.coins} onChange={e => upd(kid.id, k => ({ ...k, dream: { ...k.dream, coins: +e.target.value || 1 } }))} /></div>
    </section>

    <section className="card"><h2>Add child 👶</h2>
      <div className="row"><input style={{ width: 60 }} value={nk.avatar} onChange={e => setNk({ ...nk, avatar: e.target.value })} /><input placeholder="Name" value={nk.name} onChange={e => setNk({ ...nk, name: e.target.value })} /></div>
      <button className="go wide" disabled={!nk.name} onClick={() => { const k = { ...demoKid(nk.name, nk.avatar), coins: 0, quests: [] }; setS(p => ({ ...p, kids: [...p.kids, k], active: k.id })); setNk({ name: '', avatar: '🐯' }) }}>Add</button>
      <label>Change PIN</label><input inputMode="numeric" maxLength={4} value={s.pin} onChange={e => setS(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} />
    </section>
    {s.log.length > 0 && <section className="card"><h2>Payments</h2>{s.log.map((l, i) => <small key={i} className="muted" style={{ display: 'block' }}>{l}</small>)}</section>}
  </main>
}
