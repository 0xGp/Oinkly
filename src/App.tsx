import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import * as C from './chain'
import { addressFromPrivateKey, cleanKey, newPiggyKey, signLogin, validKey } from './keys'
import { LESSONS, WEEK, uid, applyParent, applyKid, type Break, type Family, type Kid, type KidView, type KidOp, type ParentOp, type Spend } from './model'

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
const ANIMALS = ['🦁', '🐼', '🐯', '🐰', '🦊', '🐨', '🐸', '🐵', '🦄', '🐧']
const api = async (url: string, init?: RequestInit) => { const r = await fetch(url, init); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j }
function useToast() { const [t, setT] = useState(''); return [t, (m: string) => { setT(m); setTimeout(() => setT(''), 4000) }] as const }
function useNgn() { const [v, setV] = useState<number | null>(null); useEffect(() => { C.nimNgn().then(setV).catch(() => {}) }, []); return (c: number) => v ? `≈ ₦${Math.round(c * C.NIM_PER_COIN * v).toLocaleString()}` : '' }

const KEY = 'oinkly-kid-key'
const shareOrigin = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && import.meta.env.VITE_LAN_ORIGIN ? import.meta.env.VITE_LAN_ORIGIN : location.origin
async function kidLogin(key: string) {
  const j = await api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signLogin(key)) })
  localStorage.setItem('oinkly-kid-token', j.token); localStorage.setItem(KEY, cleanKey(key))
  return j as { token: string; name: string }
}

export default function App() {
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('key')
  if (hashKey) return <KidJoin initialKey={hashKey} back={() => { location.replace('/') }} />
  const q = new URLSearchParams(location.search)
  const t = q.get('kid') || localStorage.getItem('oinkly-kid-token')
  if (t) { localStorage.setItem('oinkly-kid-token', t); return <KidApp token={t} /> }
  return <Onboard />
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-bg" onClick={onClose}><div className="modal card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>{children}</div></div>
}

function Receipt({ b, name, avatar, forParent, onClose }: { b: Break; name: string; avatar: string; forParent?: boolean; onClose: () => void }) {
  const coins = b.coins ?? Math.round(b.nim / C.NIM_PER_COIN)
  const earned = b.earned || []
  const saved = coins - earned.reduce((s, q) => s + q.coins, 0)
  return <Modal onClose={onClose}><div className="receipt">
    <div className="rhead"><div className="brand" style={{ fontSize: 22 }}>🐷 Oinkly</div><b>RECEIPT</b><small className="muted">#{b.tx.slice(0, 8).toUpperCase()}</small></div>
    <div className="rstamp">PAID</div>
    <div className="rrow"><span>Date</span><span>{new Date(b.at).toLocaleString()}</span></div>
    <div className="rrow"><span>From</span><span>{avatar} {name}'s Piggy</span></div>
    <div className="rrow"><span>To</span><span>{forParent ? 'You, the grown-up' : 'My grown-up'}</span></div>
    <div className="rrow"><span>For</span><span>{b.what}{b.need != null && (b.need ? ' · 🍎 Need' : ' · 🎮 Want')}</span></div>
    <div className="rsec">Earned by doing</div>
    {earned.length ? earned.map((q, i) => <div className="rrow" key={i}><span>{q.emoji} {q.title}</span><span>{q.coins} 🪙</span></div>)
      : <p className="muted">No new quests since the last receipt.</p>}
    {saved > 0 && <div className="rrow"><span>🐷 From savings &amp; pocket money</span><span>{saved} 🪙</span></div>}
    <div className="rrow rtotal"><span>Total sent</span><span>{coins} 🪙{forParent ? ` = ${b.nim} NIM` : ''}</span></div>
    {forParent
      ? <p className="muted">💵 The NIM is in your Nimiq Pay wallet. Cash it out and get {name}'s {b.what}. <a href={C.txUrl(b.tx)} target="_blank">View payment</a></p>
      : <p className="muted center">✅ Sent to your grown-up. Now they can get your {b.what}!</p>}
    <button className="go wide" onClick={onClose}>{forParent ? 'Got it' : 'Yay! 🎉'}</button>
  </div></Modal>
}

/* ---------------- FIRST SCREEN ---------------- */
function Onboard() {
  const [role, setRole] = useState<'parent' | 'kid' | null>(() => sessionStorage.getItem('oinkly-parent') ? 'parent' : null)
  if (role === 'parent') return <ParentApp back={() => setRole(null)} />
  if (role === 'kid') return <KidJoin back={() => setRole(null)} />
  return <div className="app"><header><div className="brand">🐷 Oinkly</div>{C.TESTNET && <div className="muted center">TESTNET</div>}</header><main>
    <section className="card center"><div style={{ fontSize: 90 }}>🐷</div><h2>Are you a parent?</h2>
      <p className="muted">Grown-ups set up the family. Kids open their own Piggy.</p>
      <button className="go wide" onClick={() => setRole('parent')}>Yes, I'm a parent 👪</button>
      <button className="pill" style={{ marginTop: 10 }} onClick={() => setRole('kid')}>No, I'm a kid 🧒</button>
    </section></main></div>
}

function KidJoin({ back, initialKey = '' }: { back: () => void; initialKey?: string }) {
  const [v, setV] = useState('')
  const [key, setKey] = useState(initialKey)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const token = (() => { const s = v.trim(); try { return new URL(s).searchParams.get('kid') || '' } catch { return s } })()
  async function login(k: string) {
    setBusy(true); setErr('')
    try { await kidLogin(k); location.replace('/') } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  useEffect(() => { if (initialKey) { history.replaceState(null, '', location.pathname); if (validKey(initialKey)) login(initialKey) } }, [])
  return <div className="app"><header><div className="brand">🐷 Oinkly</div></header><main>
    <section className="card center"><div style={{ fontSize: 90 }}>🧒</div><h2>Hi there!</h2>
      <p className="muted">Log in with the <b>Piggy key</b> your grown-up made for you. Scan its QR code with this phone's camera, or paste it here.</p>
      <input placeholder="Paste your Piggy key" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} />
      <button className="go wide" disabled={!validKey(key) || busy} onClick={() => login(key)}>{busy ? 'Opening…' : 'Log in with my key 🔑'}</button>
      {err && <p className="muted">😕 {err}</p>}
    </section>
    <section className="card center"><p className="muted">No key? Your grown-up can open <b>Kid's phone</b> and you scan that QR code, or paste the link they sent you:</p>
      <input placeholder="Paste your Piggy link" value={v} onChange={e => setV(e.target.value)} />
      <button className="pill" disabled={token.length < 16} onClick={() => { location.href = `/?kid=${encodeURIComponent(token)}` }}>Open my Piggy 🐷</button>
      <button className="pill" style={{ marginTop: 10 }} onClick={back}>← Back</button>
    </section></main></div>
}

/* ---------------- KID DEVICE ---------------- */
function KidApp({ token }: { token: string }) {
  const [kid, setKid] = useState<KidView | null>(null)
  const [parent, setParent] = useState('')
  const [key, setKey] = useState(() => localStorage.getItem(KEY) || '')
  const [err, setErr] = useState('')
  const [toast, say] = useToast()
  const prev = useRef(0)
  const last = useRef<KidView | null>(null)
  const [receipt, setReceipt] = useState<Break | null>(null)
  const [drop, setDrop] = useState(0)
  const naira = useNgn()
  const coinDrop = () => { setDrop(d => d + 1); clink() }
  async function load(op?: KidOp) {
    try {
      const j = await api(`/api/kid?t=${encodeURIComponent(token)}`, op ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(op) } : undefined)
      const k = j.kid as KidView, old = last.current
      const paid = old && k.quests.find(q => q.status === 'paid' && old.quests.find(o => o.id === q.id)?.status !== 'paid')
      if (paid) { coinDrop(); say(`🎉 Your grown-up paid you ${paid.coins} coins for "${paid.title}"!`) }
      else if (prev.current && k.coins + k.seeds > prev.current) { coinDrop(); say('🪙 Coins arrived in your Piggy!') }
      const newL = old && k.lessons.find(l => !old.lessons.includes(l)); if (newL) setTimeout(() => say(`🏅 New badge: ${LESSONS.find(l => l.id === newL)?.title}!`), 900)
      prev.current = k.coins + k.seeds; last.current = k; setKid(k); setParent(j.parent); setErr('')
    } catch (e) { setErr(String((e as Error).message)) }
  }
  useEffect(() => { load(); const i = setInterval(() => load(), 10_000); return () => clearInterval(i) }, [token])
  const logout = () => { localStorage.removeItem('oinkly-kid-token'); localStorage.removeItem(KEY); location.href = '/' }
  async function addKey(k: string) {
    try { const j = await kidLogin(k); if (j.token !== token) return logout(); setKey(cleanKey(k)); say('🔑 Key added!') }
    catch (e) { say('😕 ' + (e as Error).message) }
  }
  if (!kid) return <div className="app"><header><div className="brand">🐷 Oinkly</div></header><section className="card center">{err ? <>😕 {err}<br /><button className="pill" onClick={logout}>Start over</button></> : 'Opening your Piggy…'}</section></div>
  const act = async (op: KidOp, msg?: string) => { await load(op); if (msg) say(msg) }
  async function broke(s: Spend, tx: string, nim: number) {
    coinDrop()
    await act({ op: 'broke', brk: { at: Date.now(), what: s.what, nim, to: 'grown-up', tx, spendId: s.id } }, `🔨 CRASH! ${s.coins} coins sent for your ${s.what}!`)
    const b = last.current?.breaks?.find(x => x.tx === tx); if (b) setReceipt(b)
  }
  return <>
    <KidScreen kid={kid} toast={toast} drop={drop} coinDrop={coinDrop} naira={naira} act={act}
      header={<button onClick={logout} title="Log out">🚪</button>}
      extra={<BreakBank kid={kid} parent={parent} keyHex={key} onKey={addKey} onBroke={broke} onReceipt={setReceipt} />} />
    {receipt && <Receipt b={receipt} name={kid.name} avatar={kid.avatar} onClose={() => setReceipt(null)} />}
  </>
}

function BreakBank({ kid, parent, keyHex, onKey, onBroke, onReceipt }: { kid: KidView; parent: string; keyHex: string; onKey: (k: string) => void; onBroke: (s: Spend, tx: string, nim: number) => Promise<void>; onReceipt: (b: Break) => void }) {
  const [bal, setBal] = useState<number | null>(null)
  const [sure, setSure] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [k, setK] = useState('')
  useEffect(() => {
    if (!keyHex) return
    const read = () => C.jarBalanceNim(addressFromPrivateKey(keyHex)).then(setBal).catch(() => setBal(-1))
    read(); const i = setInterval(read, 20_000); return () => clearInterval(i)
  }, [keyHex])
  const approved = kid.spends.filter(s => s.status === 'ok')
  const receipts = (kid.breaks || []).slice(-5).reverse()
  async function smash(s: Spend) {
    if (sure !== s.id) return setSure(s.id)
    setBusy(s.id); setErr('')
    try {
      const nim = s.coins * C.NIM_PER_COIN
      const r = await C.breakBank(keyHex, parent, nim, `Oinkly: ${kid.name} broke the bank for ${s.what}`)
      setBal(b => b != null && b >= 0 ? b - nim : b); setSure('')
      await onBroke(s, r.hash, nim)
    } catch (e) { setErr(C.errMsg(e)) } finally { setBusy('') }
  }
  return <section className="card"><h2>Break the bank 🔨</h2>
    {!keyHex ? <>
      <p className="muted">To break your Piggy for something your grown-up said yes to, add the Piggy key they gave you.</p>
      <input placeholder="Paste your Piggy key" autoComplete="off" value={k} onChange={e => setK(e.target.value)} />
      <button className="go wide" disabled={!validKey(k)} onClick={() => onKey(k)}>Add my key 🔑</button>
    </> : <>
      <p className="muted">{bal == null ? 'Counting your Piggy…' : bal < 0 ? "Can't reach your Piggy right now." : `Your Piggy holds ${Math.round(bal / C.NIM_PER_COIN * 10) / 10} coins.`} When your grown-up says yes to a spend, break the bank to send those coins to them so they can buy it.</p>
      {approved.map(s => <div className="quest" key={s.id}><span className="qe">🛍️</span><div style={{ flex: 1 }}><b>{s.what}</b><small> {s.coins} coins · ✅ approved</small></div>
        <button className="go" disabled={!!busy || !C.validAddr(parent)} onClick={() => smash(s)}>{busy === s.id ? 'Breaking…' : sure === s.id ? `Yes! Send ${s.coins} 🪙` : '🔨 Break'}</button></div>)}
      {sure && !busy && <button className="pill" onClick={() => setSure('')}>Not yet, keep saving</button>}
      {!approved.length && <p className="muted">Nothing approved yet. Ask to spend above, and when your grown-up says yes it shows up here. 👆</p>}
      {err && <p className="muted">⚠️ {err}</p>}
    </>}
    {receipts.length > 0 && <><label>My receipts 🧾</label>
      {receipts.map(b => <div key={b.tx} className="rrow"><span>{new Date(b.at).toLocaleDateString()} · {b.what}</span><button className="linkbtn" onClick={() => onReceipt(b)}>🧾 View</button></div>)}</>}
  </section>
}

function KidScreen({ kid, toast, drop, coinDrop, naira, act, header, extra }: { kid: KidView; toast: string; drop: number; coinDrop: () => void; naira: (c: number) => string; act: (op: KidOp, msg?: string) => void; header?: React.ReactNode; extra?: React.ReactNode }) {
  const [tab, setTab] = useState<'piggy' | 'badges'>('piggy')
  const pct = Math.min(100, Math.round(((kid.coins + kid.seeds) / kid.dream.coins) * 100))
  const bonusReady = Date.now() - kid.lastBonus >= WEEK
  const bonusAmt = Math.max(1, Math.round(kid.coins * 0.05))
  return <div className="app">
    {toast && <div className="toast" role="status">{toast}</div>}
    <header><div className="brand">🐷 Oinkly</div>
      <nav><button className={tab === 'piggy' ? 'on' : ''} onClick={() => setTab('piggy')}>{kid.avatar} {kid.name}'s Piggy</button><button className={tab === 'badges' ? 'on' : ''} onClick={() => setTab('badges')}>Badges</button>{header}</nav></header>
    {tab === 'piggy' ? <main>
      <section className="piggy card">
        <div className="jar" onClick={coinDrop} aria-label="Piggy jar"><div className="pig bounce" key={drop}>🐷</div>{drop > 0 && <div className="coin fall" key={'c' + drop}>🪙</div>}</div>
        <div className="big">{kid.coins} <span>coins</span></div>
        <div className="muted">+ {kid.seeds} 🌱 Patience Seeds · {naira(kid.coins + kid.seeds)}</div>
        <div className="level">⭐ Level {kid.lessons.length}</div>
      </section>
      <section className="card dream"><h2>My Dream {kid.dream.emoji}</h2>
        <div className="dreamrow"><div className="dreamimg" style={{ filter: `grayscale(${100 - pct}%)` }}>{kid.dream.emoji}</div>
          <div style={{ flex: 1 }}><b>{kid.dream.title}</b><div className="bar"><div style={{ width: pct + '%' }} /></div><small>{kid.coins + kid.seeds} / {kid.dream.coins} coins · {pct}%</small></div></div></section>
      <section className="card"><h2>Quests ⚔️</h2>
        {kid.quests.filter(q => q.status !== 'paid').map(q => <div className="quest" key={q.id}><span className="qe">{q.emoji}</span><div style={{ flex: 1 }}><b>{q.title}</b><small> +{q.coins} coins</small></div>
          {q.status === 'open' ? <button className="go" onClick={() => act({ op: 'questDone', questId: q.id }, '🎉 Great job! Waiting for your grown-up to pay.')}>I did it!</button> : <span className="wait">⏳ Waiting for payment</span>}</div>)}
        {!kid.quests.some(q => q.status !== 'paid') && <p className="muted">No quests right now. 🏆</p>}
        {kid.quests.filter(q => q.status === 'paid').slice(-3).reverse().map(q => <div className="quest" key={q.id}><span className="qe">{q.emoji}</span><div style={{ flex: 1 }}><b>{q.title}</b><small> +{q.coins} coins</small></div><span className="wait">✅ Paid!</span></div>)}</section>
      <section className="card"><h2>Patience Seeds 🌱</h2>
        <p className="muted">Don't spend for a week and Piggy grows {bonusAmt} extra coin{bonusAmt > 1 ? 's' : ''}! That is called <b>interest</b>.</p>
        <button className="go wide" disabled={!bonusReady} onClick={() => { coinDrop(); act({ op: 'harvest' }, `🌱 Your patience grew ${bonusAmt} seeds!`) }}>{bonusReady ? `Harvest ${bonusAmt} seeds 🌻` : `Growing… ${Math.ceil((WEEK - (Date.now() - kid.lastBonus)) / 864e5)} days left`}</button></section>
      <AskSpend coins={kid.coins - kid.spends.filter(s => s.status === 'ok').reduce((t, s) => t + s.coins, 0)} onAsk={(what, coins, need) => act({ op: 'ask', spend: { id: uid(), what, coins, need, status: 'asked' } }, '📨 Sent to your grown-up!')} />
      {kid.spends.slice(-3).reverse().map(sp => <div key={sp.id} className="muted center">{sp.what} ({sp.coins} 🪙) — {sp.status === 'asked' ? '⏳ waiting for your grown-up' : sp.status === 'ok' ? '✅ Yes! Break the bank below 👇' : sp.status === 'spent' ? '🧾 done' : '🙅 not now'}</div>)}
      {extra}
    </main> : <main><section className="card"><h2>Money Badges 🏅</h2><p className="muted">Grow your Piggy to unlock wisdom!</p>
      {LESSONS.map(l => { const on = kid.lessons.includes(l.id); return <div key={l.id} className={'badge ' + (on ? 'got' : 'locked')}><div className="be">{on ? l.emoji : '🔒'}</div><div><b>{l.title}</b><div className="muted">{on ? l.line : `Unlocks at ${l.at} coins`}</div></div></div> })}</section></main>}
  </div>
}

function AskSpend({ coins, onAsk }: { coins: number; onAsk: (w: string, c: number, n: boolean) => void }) {
  const [what, setWhat] = useState(''); const [c, setC] = useState(3); const [need, setNeed] = useState<boolean | null>(null)
  return <section className="card"><h2>Ask to spend 🛍️</h2>
    <input placeholder="What do you want?" value={what} onChange={e => setWhat(e.target.value)} />
    <div className="row">{[1, 3, 5, 10].map(v => <button key={v} className={'pill ' + (c === v ? 'on' : '')} onClick={() => setC(v)}>{v} 🪙</button>)}</div>
    <p className="muted">Is it a <b>Need</b> or a <b>Want</b>?</p>
    <div className="row"><button className={'pill ' + (need === true ? 'on' : '')} onClick={() => setNeed(true)}>🍎 Need</button><button className={'pill ' + (need === false ? 'on' : '')} onClick={() => setNeed(false)}>🎮 Want</button></div>
    <button className="go wide" disabled={!what || need === null || c > coins} onClick={() => { onAsk(what, c, !!need); setWhat(''); setNeed(null) }}>{c > coins ? 'Not enough coins yet' : 'Ask my grown-up'}</button></section>
}

/* ---------------- PARENT DEVICE ---------------- */
function ParentApp({ back }: { back: () => void }) {
  const [addr, setAddr] = useState<string | null>(() => sessionStorage.getItem('oinkly-parent'))
  const [demo, setDemo] = useState(() => sessionStorage.getItem('oinkly-demo') === '1')
  const [err, setErr] = useState('')
  useEffect(() => { if (!addr) C.parentAddress().then(a => { sessionStorage.setItem('oinkly-parent', a); setAddr(a) }).catch(e => setErr(C.errMsg(e))) }, [])
  if (!addr) return <div className="app"><header><div className="brand">🐷 Oinkly</div></header><main>
    <section className="card center"><div style={{ fontSize: 90 }}>🐷</div><h2>A piggy bank for kids</h2>
      <p className="muted">Grown-ups: open Oinkly inside <b>Nimiq Pay</b> to connect your wallet. Your Nimiq address becomes your family account.</p>
      {err && <p className="muted">({err})</p>}
      <button className="go wide" onClick={() => C.parentAddress().then(a => { sessionStorage.setItem('oinkly-parent', a); setAddr(a) }).catch(e => setErr(C.errMsg(e)))}>Connect Nimiq Pay</button>
      <button className="pill" style={{ marginTop: 10 }} onClick={() => { const a = newPiggyKey().address; sessionStorage.setItem('oinkly-parent', a); sessionStorage.setItem('oinkly-demo', '1'); setDemo(true); setAddr(a) }}>Try a demo family (no payments)</button>
      <button className="pill" style={{ marginTop: 10 }} onClick={back}>← Back</button>
    </section></main></div>
  return <Family parent={addr} demo={demo} />
}

function Family({ parent, demo }: { parent: string; demo: boolean }) {
  const P = C.normAddr(parent)
  const sKey = `oinkly-secret-${P}`, kKey = `oinkly-keys-${P}`, pKey = `oinkly-pin-${P}`
  const [secret, setSecret] = useState(() => localStorage.getItem(sKey) || '')
  const [fam, setFam] = useState<Family | null>(null)
  const [storage, setStorage] = useState('')
  const [err, setErr] = useState('')
  const [active, setActive] = useState('')
  const [view, setView] = useState<'pin' | 'parent' | 'kid'>(() => localStorage.getItem(pKey) ? 'pin' : 'parent')
  const [toast, say] = useToast()
  const [drop, setDrop] = useState(0)
  const naira = useNgn()
  const coinDrop = () => { setDrop(d => d + 1); clink() }
  const headers = { 'content-type': 'application/json', 'x-family-secret': secret }
  async function sync(ops: ParentOp[] = [], log?: string) {
    if (fam && ops.length) setFam(ops.reduce(applyParent, fam))
    try { const j = await api(`/api/family?parent=${P}`, ops.length || log ? { method: 'POST', headers, body: JSON.stringify({ ops, log }) } : { headers }); setStorage(j.storage); setFam(j.family ?? { parent: P, kids: [], log: [], updated: 0 }); setErr('') }
    catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { if (!secret) { const s = uid(12) + uid(12); localStorage.setItem(sKey, s); setSecret(s); return } sync(); const i = setInterval(() => sync(), 15_000); return () => clearInterval(i) }, [secret])
  const kid = fam?.kids.find(k => k.id === active) || fam?.kids[0]
  const rKey = `oinkly-receipts-seen-${P}`
  const [later, setLater] = useState<string[]>([])
  const [seen, setSeen] = useState<string[]>(() => JSON.parse(localStorage.getItem(rKey) || '[]'))
  const [shown, setShown] = useState<{ k: Kid; b: Break } | null>(null)
  const asking = fam?.kids.flatMap(k => k.spends.filter(s => s.status === 'asked' && !later.includes(s.id)).map(s => ({ k, s })))[0]
  const fresh = fam?.kids.flatMap(k => (k.breaks || []).filter(b => !seen.includes(b.tx)).map(b => ({ k, b })))[0]
  const receipt = shown || fresh
  function closeReceipt() {
    if (receipt && !seen.includes(receipt.b.tx)) { const n = [...seen, receipt.b.tx].slice(-100); setSeen(n); localStorage.setItem(rKey, JSON.stringify(n)) }
    setShown(null)
  }
  async function decide(k: Kid, s: Spend, ok: boolean) {
    await sync([{ op: 'spendDecision', kidId: k.id, spendId: s.id, ok }])
    say(ok ? `✅ ${k.name} can now break the bank for ${s.what}` : `🙅 Told ${k.name} "not now"`)
  }
  if (view === 'pin') return <Pin pin={localStorage.getItem(pKey) || ''} ok={() => setView('parent')} />
  if (err && !fam) return <div className="app"><section className="card"><h2>😕 Can't open family</h2><p className="muted">{err}</p><Recovery sKey={sKey} secret={secret} /></section></div>
  if (!fam) return <div className="app"><section className="card center">Loading your family…</section></div>
  if (view === 'kid' && kid) return <KidScreen kid={kid} toast={toast} drop={drop} coinDrop={coinDrop} naira={naira}
    header={<button onClick={() => setView(localStorage.getItem(pKey) ? 'pin' : 'parent')}>🔒</button>}
    act={(op, msg) => { setFam(f => f && applyKidLocal(f, kid.id, op)); fetch(`/api/kid?t=${kid.token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(op) }).then(() => sync()); if (msg) say(msg) }} />
  return <div className="app">
    {toast && <div className="toast" role="status">{toast}</div>}
    <header><div className="brand">🐷 Oinkly</div><div className="muted center">Family of <code>{P.slice(0, 4)}…{P.slice(-4)}</code>{C.TESTNET && ' · TESTNET'}{demo && ' · DEMO (payments off)'}{storage === 'memory' && ' · ⚠️ temp storage'}</div></header>
    <Parent fam={fam} kid={kid} parent={P} demo={demo} kKey={kKey} pKey={pKey} setActive={setActive} sync={sync} say={say} coinDrop={coinDrop} naira={naira} openKid={() => setView('kid')}
      decide={decide} showReceipt={(k, b) => setShown({ k, b })} />
    <section className="card"><Recovery sKey={sKey} secret={secret} /></section>
    {receipt ? <Receipt b={receipt.b} name={receipt.k.name} avatar={receipt.k.avatar} forParent onClose={closeReceipt} />
      : asking && <Modal onClose={() => setLater(l => [...l, asking.s.id])}><div className="center">
        <div style={{ fontSize: 56 }}>{asking.k.avatar}</div><h2>{asking.k.name} wants to spend</h2>
        <div className="ask-what">🛍️ {asking.s.what}</div>
        <p className="muted">{asking.s.coins} coins ({asking.s.coins * C.NIM_PER_COIN} NIM) · {asking.s.need ? '🍎 a Need' : '🎮 a Want'} · {asking.k.name} has {asking.k.coins} coins</p>
        <p className="muted">If you say yes, {asking.k.name} can break the bank and send you the NIM so you can buy it.</p>
        <button className="go wide" onClick={() => decide(asking.k, asking.s, true)}>✅ Yes, {asking.k.name} can spend it</button>
        <div className="row" style={{ justifyContent: 'center' }}><button className="pill" onClick={() => decide(asking.k, asking.s, false)}>🙅 Not now</button><button className="pill" onClick={() => setLater(l => [...l, asking.s.id])}>Decide later</button></div>
      </div></Modal>}
  </div>
}
function applyKidLocal(f: Family, id: string, op: KidOp) { return applyKid(f, id, op) }

function Recovery({ sKey, secret }: { sKey: string; secret: string }) {
  const [show, setShow] = useState(false); const [v, setV] = useState('')
  return <details><summary className="muted">Family recovery code (use on a 2nd grown-up phone)</summary>
    {show ? <code style={{ wordBreak: 'break-all' }}>{secret}</code> : <button className="pill" onClick={() => setShow(true)}>Show code</button>}
    <input placeholder="Paste a recovery code" value={v} onChange={e => setV(e.target.value)} />
    <button className="pill" disabled={v.length < 16} onClick={() => { localStorage.setItem(sKey, v.trim()); location.reload() }}>Use this code</button></details>
}

function Pin({ pin, ok }: { pin: string; ok: () => void }) {
  const [v, setV] = useState('')
  useEffect(() => { if (v.length === 4) { if (v === pin) ok(); else setTimeout(() => setV(''), 300) } }, [v])
  return <div className="app"><header><div className="brand">🐷 Oinkly</div></header><main><section className="card center"><h2>Grown-ups only 🔒</h2><p className="muted">Enter your PIN</p>
    <div className="dots">{[0, 1, 2, 3].map(i => <span key={i} className={i < v.length ? 'f' : ''} />)}</div>
    <div className="pad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((d, i) => <button key={i} disabled={d === ''} onClick={() => setV(x => d === '⌫' ? x.slice(0, -1) : (x + d).slice(0, 4))}>{d}</button>)}</div>
  </section></main></div>
}

type PP = { fam: Family; kid?: Kid; parent: string; demo: boolean; kKey: string; pKey: string; setActive: (id: string) => void; sync: (ops?: ParentOp[], log?: string) => Promise<void>; say: (m: string) => void; coinDrop: () => void; naira: (c: number) => string; openKid: () => void; decide: (k: Kid, s: Spend, ok: boolean) => Promise<void>; showReceipt: (k: Kid, b: Break) => void }
function Parent({ fam, kid, parent, demo, kKey, pKey, setActive, sync, say, coinDrop, naira, openKid, decide, showReceipt }: PP) {
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState({ title: '', emoji: '🧹', coins: 2 })
  const [nk, setNk] = useState({ name: '', avatar: '🦁', paste: '' })
  const [pocket, setPocket] = useState(5)
  const [qr, setQr] = useState('')
  const [keyQr, setKeyQr] = useState('')
  const [bal, setBal] = useState<number | null>(null)
  const [pin, setPin] = useState(localStorage.getItem(pKey) || '')
  useEffect(() => { setQr(''); setKeyQr(''); setBal(null); if (kid) C.jarBalanceNim(kid.jar).then(setBal).catch(() => setBal(-1)) }, [kid?.id])
  const keys = (): Record<string, string> => JSON.parse(localStorage.getItem(kKey) || '{}')

  async function createPiggy() {
    const id = uid(6)
    let jar = nk.paste.trim().toUpperCase(), custody: Kid['custody'] = 'pasted'
    if (!jar) { const k = newPiggyKey(); jar = k.address; custody = 'app-key'; localStorage.setItem(kKey, JSON.stringify({ ...keys(), [id]: k.privateKey })) }
    else if (!C.validAddr(jar)) return say('That Nimiq address looks wrong (NQ.. 36 characters)')
    if (C.normAddr(jar) === parent) return say("A child's Piggy can't be your own address")
    const k: Kid = { id, name: nk.name.trim(), avatar: nk.avatar, jar, custody, token: uid(16) + uid(8), coins: 0, seeds: 0, lastBonus: Date.now(), lessons: [], quests: [], spends: [], dream: { title: 'New bicycle', emoji: '🚲', coins: 100 } }
    await sync([{ op: 'addKid', kid: k }]); setActive(id); setNk({ name: '', avatar: '🦁', paste: '' }); say(`🐷 ${k.name}'s Piggy is ready! Now link it.`)
  }
  async function pay(nim: number, memo: string, then: (tx: string) => ParentOp | null, log: string) {
    if (!kid) return
    if (demo) { const op = then('demo-' + uid(6)); if (op) await sync([op], `[demo] ${log}`); coinDrop(); return say(`(demo) Would send ${nim} NIM · "${memo}"`) }
    setBusy(memo)
    try { const tx = await C.payNim(kid.jar, nim, memo); const op = then(tx); await sync(op ? [op] : [], `${new Date().toLocaleString()} ${log} · ${tx.slice(0, 10)}…`); coinDrop(); say(`✅ ${kid.name} received ${nim} NIM`); return tx }
    catch (e) { say('⚠️ ' + C.errMsg(e)) } finally { setBusy('') }
  }
  async function link() {
    if (!kid) return
    const tx = await pay(1, C.linkMemo(kid.id), () => null, `Linked ${kid.name}'s Piggy`)
    if (demo) return sync([{ op: 'setLinked', kidId: kid.id, tx: 'demo', linked: true }])
    if (tx) { await sync([{ op: 'setLinked', kidId: kid.id, tx, linked: false }]); setTimeout(check, 20_000) }
  }
  async function check() {
    if (!kid) return
    try { const r = await C.verifyLink(kid.jar, kid.id, parent); await sync([{ op: 'setLinked', kidId: kid.id, tx: r.hash || kid.linkTx || '', linked: r.ok }]); say(r.ok ? '🔗 Link verified on-chain!' : '⏳ ' + r.reason) }
    catch (e) { say('⚠️ ' + C.errMsg(e)) }
  }
  const linkSent = !!kid?.linked || !!kid?.linkTx
  /** Pays the kid; the first payment carries the link memo, so linking needs no extra step. */
  async function payKid(nim: number, memo: string, then: (tx: string) => ParentOp, log: string) {
    if (!kid) return
    if (linkSent) return pay(nim, memo, then, log)
    const tx = await pay(nim, C.linkMemo(kid.id), then, `${log} (+ linked Piggy)`)
    if (demo) return sync([{ op: 'setLinked', kidId: kid.id, tx: 'demo', linked: true }])
    if (tx) { await sync([{ op: 'setLinked', kidId: kid.id, tx, linked: false }]); setTimeout(check, 20_000) }
  }
  const done = kid?.quests.filter(x => x.status === 'done') || []
  const paid = kid?.quests.filter(x => x.status === 'paid').slice(-5).reverse() || []
  return <main>
    {!demo && C.networkMismatch() && <section className="card"><p>⚠️ {C.networkMismatch()}</p></section>}
    <section className="card"><h2>Grown-up corner 👨‍👩‍👧</h2>
      <div className="kids">{fam.kids.map(k => <button key={k.id} className={'kidchip ' + (k.id === kid?.id ? 'on' : '')} onClick={() => setActive(k.id)}>{k.avatar} {k.name}{k.linked ? ' 🔗' : ''}</button>)}</div>
      {kid ? <>
        <div className="muted">Piggy: <code style={{ fontSize: 12 }}>{kid.jar}</code><br />{bal == null ? 'Balance: reading chain…' : bal < 0 ? 'Balance: Nimiq RPC unavailable' : `On-chain: ${bal.toFixed(2)} NIM`} · {kid.custody === 'app-key' ? 'key kept on this phone' : 'your own wallet address'}</div>
        {kid.linked ? <p>🔗 <b>Linked to you on-chain</b> {kid.linkTx && kid.linkTx !== 'demo' && <a href={C.txUrl(kid.linkTx)} target="_blank">view</a>}</p>
          : <div><p className="muted">{kid.linkTx ? '⏳ Link sent, checking the chain…' : <>Not linked yet. Your first payment to {kid.name} links the Piggy to you automatically (memo <code>{C.linkMemo(kid.id)}</code>), or link now with 1 NIM.</>} The first link to a Piggy decides its grown-up.</p>
            <div className="row">{!kid.linkTx && <button className="pill" disabled={!!busy} onClick={link}>🔗 Link Piggy (1 NIM)</button>}{kid.linkTx && <button className="pill" onClick={check}>Check link</button>}</div></div>}
        <div className="row"><button className="pill" onClick={async () => { const url = `${shareOrigin()}/?kid=${kid.token}`; setKeyQr(''); setQr(await QRCode.toDataURL(url, { width: 360, margin: 1 })) }}>📱 Kid's phone</button>
          {kid.custody === 'app-key' && keys()[kid.id] && <button className="pill" onClick={async () => { setQr(''); setKeyQr(await QRCode.toDataURL(`${shareOrigin()}/#key=${keys()[kid.id]}`, { width: 360, margin: 1 })) }}>🔑 Kid's login key</button>}
          <button className="pill" onClick={openKid}>👀 Open kid screen here</button></div>
        {keyQr && <div className="center"><img src={keyQr} alt={`${kid.name}'s Piggy key`} style={{ width: 220 }} />
          <div className="muted">⚠️ {kid.name} scans this to log in and can then <b>break the bank</b> (send the whole Piggy). Only show it to {kid.name}.</div>
          <input readOnly value={keys()[kid.id]} onFocus={e => e.target.select()} /></div>}
        {qr && <div className="center"><img src={qr} alt="QR for kid's phone" style={{ width: 220 }} /><div className="muted">Scan with {kid.name}'s phone camera. Shows only {kid.name}'s Piggy, no wallet.</div><input readOnly value={`${shareOrigin()}/?kid=${kid.token}`} onFocus={e => e.target.select()} /></div>}
      </> : <p className="muted">Add your first child below 👇</p>}
    </section>

    {kid && <>
      <section className="card"><h2>Approve quests ✅</h2>
        {done.map(x => <div className="quest" key={x.id}><span className="qe">{x.emoji}</span><div style={{ flex: 1 }}><b>{x.title}</b><small> {kid.name} says it's done · {x.coins} coins = {x.coins * C.NIM_PER_COIN} NIM {naira(x.coins)}</small></div>
          <button className="go" disabled={!!busy} onClick={() => payKid(x.coins * C.NIM_PER_COIN, `Quest: ${x.title} · ${kid.name}`, tx => ({ op: 'paidQuest', kidId: kid.id, questId: x.id, tx }), `${kid.name}: Quest ${x.title}`)}>{busy ? 'Paying…' : linkSent ? 'Pay' : '🔗 Link & pay'}</button></div>)}
        {!done.length && <p className="muted">Nothing to approve. When {kid.name} taps "I did it!", the quest shows up here.</p>}
        {!linkSent && done.length > 0 && <p className="muted">This first payment also links {kid.name}'s Piggy to you on-chain.</p>}
        {paid.length > 0 && <><label>Paid</label>{paid.map(x => <small key={x.id} className="muted" style={{ display: 'block' }}>✅ {x.emoji} {x.title}: {kid.name} received {x.coins * C.NIM_PER_COIN} NIM{x.paidAt ? ` · ${new Date(x.paidAt).toLocaleString()}` : ''} {x.tx && !x.tx.startsWith('demo') && <a href={C.txUrl(x.tx)} target="_blank">view</a>}</small>)}</>}</section>
      <section className="card"><h2>Spend requests 🛍️</h2>
        {kid.spends.filter(x => x.status === 'asked').map(x => <div className="quest" key={x.id}><div style={{ flex: 1 }}><b>{x.what}</b><small> {x.coins} coins · {x.need ? 'Need' : 'Want'}</small></div>
          <button className="go" onClick={() => decide(kid, x, true)}>Yes</button>
          <button className="pill" onClick={() => decide(kid, x, false)}>Not now</button></div>)}
        {!kid.spends.some(x => x.status === 'asked') && <p className="muted">No requests.</p>}
        {kid.spends.filter(x => x.status === 'ok').map(x => <small key={x.id} className="muted" style={{ display: 'block' }}>✅ {x.what} · {x.coins} coins: approved, waiting for {kid.name} to break the bank</small>)}
        {(kid.breaks || []).slice(-5).reverse().map(b => <div className="rrow" key={b.tx}><span>🧾 {new Date(b.at).toLocaleDateString()} · {b.what} · {b.nim} NIM to you</span><button className="linkbtn" onClick={() => showReceipt(kid, b)}>Receipt</button></div>)}</section>
      <section className="card"><h2>Pocket money 💸</h2>
        <div className="row">{[2, 5, 10, 20].map(v => <button key={v} className={'pill ' + (pocket === v ? 'on' : '')} onClick={() => setPocket(v)}>{v} 🪙</button>)}</div>
        <button className="go wide" disabled={!!busy} onClick={() => payKid(pocket * C.NIM_PER_COIN, `Pocket money · ${kid.name}`, tx => ({ op: 'pocket', kidId: kid.id, coins: pocket, tx }), `${kid.name}: Pocket money ${pocket}`)}>{linkSent ? '' : '🔗 Link & '}{linkSent ? 'Send' : 'send'} {pocket} coins ({pocket * C.NIM_PER_COIN} NIM) {naira(pocket)}</button></section>
      <section className="card"><h2>New quest ⚔️</h2>
        <div className="row"><input style={{ width: 60, flex: 'none' }} value={q.emoji} onChange={e => setQ({ ...q, emoji: e.target.value })} /><input placeholder="e.g. Make bed" value={q.title} onChange={e => setQ({ ...q, title: e.target.value })} /></div>
        <div className="row">{[1, 2, 3, 5].map(v => <button key={v} className={'pill ' + (q.coins === v ? 'on' : '')} onClick={() => setQ({ ...q, coins: v })}>{v} 🪙</button>)}</div>
        <button className="go wide" disabled={!q.title} onClick={() => { sync([{ op: 'addQuest', kidId: kid.id, quest: { id: uid(), ...q, status: 'open' } }]); setQ({ ...q, title: '' }) }}>Add quest for {kid.name}</button></section>
      <section className="card"><h2>Dream 🌈</h2><DreamEdit kid={kid} save={d => sync([{ op: 'setDream', kidId: kid.id, dream: d }])} /></section>
    </>}

    <section className="card"><h2>Add child 👶</h2>
      <input placeholder="Child's name" value={nk.name} onChange={e => setNk({ ...nk, name: e.target.value })} />
      <div className="row">{ANIMALS.map(a => <button key={a} className={'pill ' + (nk.avatar === a ? 'on' : '')} style={{ fontSize: 22 }} onClick={() => setNk({ ...nk, avatar: a })}>{a}</button>)}</div>
      <details><summary className="muted">Use an existing Nimiq address instead (optional)</summary><input placeholder="NQ.. (leave empty to create a new Piggy)" value={nk.paste} onChange={e => setNk({ ...nk, paste: e.target.value })} /></details>
      <button className="go wide" disabled={!nk.name.trim()} onClick={createPiggy}>🐷 Create Piggy</button></section>

    <section className="card"><h2>Settings</h2>
      <label>Grown-up PIN (4 digits, this phone)</label><input inputMode="numeric" maxLength={4} value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPin(v); if (v.length === 4) localStorage.setItem(pKey, v); if (!v) localStorage.removeItem(pKey) }} />
      {kid?.custody === 'app-key' && keys()[kid.id] && <details><summary className="muted">Back up {kid.name}'s Piggy key</summary><p className="muted">⚠️ This private key controls {kid.name}'s Piggy. It is stored only on this phone. Write it down; whoever has it can spend the Piggy.</p><code style={{ wordBreak: 'break-all' }}>{keys()[kid.id]}</code></details>}
      {fam.log.length > 0 && <><label>Payments</label>{fam.log.map((l, i) => <small key={i} className="muted" style={{ display: 'block' }}>{l}</small>)}</>}
    </section>
  </main>
}
function DreamEdit({ kid, save }: { kid: Kid; save: (d: Kid['dream']) => void }) {
  const [d, setD] = useState(kid.dream); useEffect(() => setD(kid.dream), [kid.id])
  return <><div className="row"><input style={{ width: 60, flex: 'none' }} value={d.emoji} onChange={e => setD({ ...d, emoji: e.target.value })} /><input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} /><input style={{ width: 80, flex: 'none' }} type="number" value={d.coins} onChange={e => setD({ ...d, coins: +e.target.value || 1 })} /></div>
    <button className="pill" onClick={() => save(d)}>Save Dream</button></>
}
