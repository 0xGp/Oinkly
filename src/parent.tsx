import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Coins, Eye, Home, KeyRound, Link2, Lock, Plus, Smartphone, Swords, Users, Wallet } from 'lucide-react'
import * as C from './chain'
import { newPiggyKey } from './keys'
import { POINTS_PER_COIN, applyKid, coinsText, applyParent, nameTag, streakDays, uid, type Break, type CashIn, type Family, type Kid, type KidOp, type ParentOp, type Spend } from './model'
import { KidScreen } from './kid'
import { api, clink, Empty, Receipt, Sheet, TabBar, Toast, TopBar, useNgn, useToast } from './ui'

const ANIMALS = ['🦁', '🐼', '🐯', '🐰', '🦊', '🐨', '🐸', '🐵', '🦄', '🐧']
const shareOrigin = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && import.meta.env.VITE_LAN_ORIGIN ? import.meta.env.VITE_LAN_ORIGIN : location.origin

export function ParentApp({ back }: { back: () => void }) {
  const [addr, setAddr] = useState<string | null>(() => sessionStorage.getItem('oinkly-parent'))
  const [demo, setDemo] = useState(() => sessionStorage.getItem('oinkly-demo') === '1')
  const [err, setErr] = useState('')
  const connect = () => C.parentAddress().then(a => { sessionStorage.setItem('oinkly-parent', a); setAddr(a) }).catch(e => setErr(C.errMsg(e)))
  useEffect(() => { if (!addr) connect() }, [])
  if (!addr) return <div className="screen">
    <div className="hero"><div className="hero-art">🐷</div><h1>A piggy bank for kids</h1>
      <p className="muted">Open Oinkly inside <b>Nimiq Pay</b> to connect your wallet. Your Nimiq address becomes your family account.</p></div>
    {err && <p className="err">{err}</p>}
    <button className="go wide" onClick={connect}><Wallet size={20} strokeWidth={2.6} /> Connect Nimiq Pay</button>
    <button className="pill wide" onClick={() => { const a = newPiggyKey().address; sessionStorage.setItem('oinkly-parent', a); sessionStorage.setItem('oinkly-demo', '1'); setDemo(true); setAddr(a) }}>Try a demo family (no payments)</button>
    <div className="stack-foot"><button className="ghost" onClick={back}>← Back</button></div>
  </div>
  return <FamilyHome parent={addr} demo={demo} />
}

function FamilyHome({ parent, demo }: { parent: string; demo: boolean }) {
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
  const lock = () => setView(localStorage.getItem(pKey) ? 'pin' : 'parent')
  if (view === 'pin') return <Pin pin={localStorage.getItem(pKey) || ''} ok={() => setView('parent')} />
  if (err && !fam) return <div className="screen"><div className="hero"><div className="hero-art">😕</div><h1>Can't open your family</h1><p className="muted">{err}</p></div><Recovery sKey={sKey} secret={secret} /></div>
  if (!fam) return <div className="screen"><div className="hero"><div className="hero-art">🐷</div><p className="muted">Loading your family…</p></div></div>
  if (view === 'kid' && kid) return <KidScreen kid={kid} toast={toast} drop={drop} coinDrop={coinDrop} naira={naira}
    corner={<button className="iconbtn" onClick={lock} aria-label="Back to grown-up view" title="Grown-up view"><Lock size={20} strokeWidth={2.4} /></button>}
    act={(op: KidOp, msg) => { setFam(f => f && applyKid(f, kid.id, op)); fetch(`/api/kid?t=${kid.token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(op) }).then(() => sync()); if (msg) say(msg) }} />
  const sub = [`${P.slice(0, 4)}…${P.slice(-4)}`, C.TESTNET && 'Testnet', demo && 'Demo, payments off', storage === 'memory' && '⚠️ temp storage'].filter(Boolean).join(' · ')
  return <div className="app">
    <Toast msg={toast} />
    <Parent fam={fam} kid={kid} parent={P} demo={demo} sub={sub} kKey={kKey} pKey={pKey} sKey={sKey} secret={secret} setActive={setActive} sync={sync} say={say} coinDrop={coinDrop} naira={naira} openKid={() => setView('kid')}
      review={s => setLater(l => l.filter(id => id !== s.id))} showReceipt={(k, b) => setShown({ k, b })} />
    {receipt ? <Receipt b={receipt.b} name={receipt.k.name} avatar={receipt.k.avatar} forParent onClose={closeReceipt} />
      : asking && <Sheet onClose={() => setLater(l => [...l, asking.s.id])}><div className="center">
        <div className="hero-art sm" aria-hidden="true">{asking.k.avatar}</div><h2>{asking.k.name} wants to spend</h2>
        <div className="ask-what">🛍️ {asking.s.what}</div>
        <div className="facts"><span>{asking.s.coins} coins<small>{asking.s.coins * C.NIM_PER_COIN} NIM</small></span><span>{asking.s.need ? '🍎 Need' : '🎮 Want'}<small>{asking.k.name}'s pick</small></span><span>{asking.k.coins}<small>coins saved</small></span></div>
        <p className="muted">If you say yes, {asking.k.name} can break the bank and send you the NIM so you can buy it.</p>
        <button className="go wide" onClick={() => decide(asking.k, asking.s, true)}>Yes, {asking.k.name} can spend it</button>
        <div className="row fill"><button className="pill" onClick={() => decide(asking.k, asking.s, false)}>Not now</button><button className="pill" onClick={() => setLater(l => [...l, asking.s.id])}>Decide later</button></div>
      </div></Sheet>}
  </div>
}

function Recovery({ sKey, secret }: { sKey: string; secret: string }) {
  const [show, setShow] = useState(false); const [v, setV] = useState('')
  return <details className="disclose"><summary>Family recovery code</summary>
    <p className="muted">Use it on a second grown-up phone to open the same family.</p>
    {show ? <code className="secret">{secret}</code> : <button className="pill" onClick={() => setShow(true)}>Show code</button>}
    <input placeholder="Paste a recovery code" aria-label="Recovery code" value={v} onChange={e => setV(e.target.value)} />
    <button className="pill" disabled={v.length < 16} onClick={() => { localStorage.setItem(sKey, v.trim()); location.reload() }}>Use this code</button></details>
}

function Pin({ pin, ok }: { pin: string; ok: () => void }) {
  const [v, setV] = useState('')
  useEffect(() => { if (v.length === 4) { if (v === pin) ok(); else setTimeout(() => setV(''), 300) } }, [v])
  return <div className="screen"><div className="hero"><div className="hero-art sm">🔒</div><h1>Grown-ups only</h1><p className="muted">Enter your PIN</p></div>
    <div className="dots" aria-label={`${v.length} of 4 digits`}>{[0, 1, 2, 3].map(i => <span key={i} className={i < v.length ? 'f' : ''} />)}</div>
    <div className="pad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((d, i) => <button key={i} disabled={d === ''} aria-label={d === '⌫' ? 'Delete' : undefined} onClick={() => setV(x => d === '⌫' ? x.slice(0, -1) : (x + d).slice(0, 4))}>{d}</button>)}</div>
  </div>
}

type ParentTab = 'home' | 'quests' | 'money' | 'family'
type SheetId = 'quest' | 'pocket' | 'child' | 'phone' | 'key' | 'dream' | null
type PP = { fam: Family; kid?: Kid; parent: string; demo: boolean; sub: string; kKey: string; pKey: string; sKey: string; secret: string; setActive: (id: string) => void; sync: (ops?: ParentOp[], log?: string) => Promise<void>; say: (m: string) => void; coinDrop: () => void; naira: (c: number) => string; openKid: () => void; review: (s: Spend) => void; showReceipt: (k: Kid, b: Break) => void }
function Parent({ fam, kid, parent, demo, sub, kKey, pKey, sKey, secret, setActive, sync, say, coinDrop, naira, openKid, review, showReceipt }: PP) {
  const [tab, setTab] = useState<ParentTab>('home')
  const [sheet, setSheet] = useState<SheetId>(null)
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState({ title: '', emoji: '🧹', coins: 2 })
  const [nk, setNk] = useState({ name: '', avatar: '🦁', paste: '' })
  const [pocket, setPocket] = useState(5)
  const [qr, setQr] = useState('')
  const [bal, setBal] = useState<number | null>(null)
  const [pin, setPin] = useState(localStorage.getItem(pKey) || '')
  useEffect(() => { setBal(null); if (kid) C.jarBalanceNim(kid.jar).then(setBal).catch(() => setBal(-1)) }, [kid?.id])
  const keys = (): Record<string, string> => JSON.parse(localStorage.getItem(kKey) || '{}')
  const close = () => { setSheet(null); setQr('') }
  async function openQr(which: 'phone' | 'key') {
    if (!kid) return
    const url = which === 'phone' ? `${shareOrigin()}/?kid=${kid.token}` : `${shareOrigin()}/#key=${keys()[kid.id]}`
    setQr(await QRCode.toDataURL(url, { width: 360, margin: 1 })); setSheet(which)
  }

  async function createPiggy() {
    const id = uid(6)
    let jar = nk.paste.trim().toUpperCase(), custody: Kid['custody'] = 'pasted'
    if (!jar) { const k = newPiggyKey(); jar = k.address; custody = 'app-key'; localStorage.setItem(kKey, JSON.stringify({ ...keys(), [id]: k.privateKey })) }
    else if (!C.validAddr(jar)) return say('That Nimiq address looks wrong (NQ.. 36 characters)')
    if (C.normAddr(jar) === parent) return say("A child's Piggy can't be your own address")
    const k: Kid = { id, name: nk.name.trim(), avatar: nk.avatar, jar, custody, token: uid(16) + uid(8), coins: 0, seeds: 0, lastBonus: Date.now(), lessons: [], quests: [], spends: [], dream: { title: 'New bicycle', emoji: '🚲', coins: 100 } }
    await sync([{ op: 'addKid', kid: k }]); setActive(id); setNk({ name: '', avatar: '🦁', paste: '' }); close(); setTab('family'); say(`🐷 ${k.name}'s Piggy is ready! Now share it with ${k.name}.`)
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
  const payQuest = (k: Kid, x: Kid['quests'][number]) => payKid(x.coins * C.NIM_PER_COIN, `Quest: ${x.title} · ${k.name}`, tx => ({ op: 'paidQuest', kidId: k.id, questId: x.id, tx }), `${k.name}: Quest ${x.title}`)
  const done = kid?.quests.filter(x => x.status === 'done') || []
  const open = kid?.quests.filter(x => x.status === 'open') || []
  const paid = kid?.quests.filter(x => x.status === 'paid').slice(-8).reverse() || []
  const asked = kid?.spends.filter(x => x.status === 'asked') || []
  const cashAsks = kid?.cashes?.filter(x => x.status === 'asked') || []
  const payCash = (k: Kid, c: CashIn) => { const coins = c.points / POINTS_PER_COIN; return payKid(coins * C.NIM_PER_COIN, `Saver points · ${k.name}`, tx => ({ op: 'cashPaid', kidId: k.id, cashId: c.id, tx }), `${k.name}: ${c.points} saver points → ${coins} coins`) }
  const approved = kid?.spends.filter(x => x.status === 'ok') || []
  const breaks = (kid?.breaks || []).slice(-5).reverse()
  const inbox = done.length + asked.length + cashAsks.length
  const hasKey = kid?.custody === 'app-key' && !!keys()[kid.id]
  const noKid = <section className="card"><Empty art="👶">Add your first child to start. They get their own Piggy, quests and dream.</Empty><button className="go wide" onClick={() => setSheet('child')}><Plus size={20} strokeWidth={2.8} /> Add a child</button></section>

  return <>
    <TopBar title="🐷 Oinkly" sub={sub}>
      {fam.kids.length > 0 && <div className="kids" role="tablist" aria-label="Children">
        {fam.kids.map(k => <button key={k.id} role="tab" aria-selected={k.id === kid?.id} className={'kidchip ' + (k.id === kid?.id ? 'on' : '')} onClick={() => setActive(k.id)}>{k.avatar} {k.name}</button>)}
        <button className="kidchip add" onClick={() => setSheet('child')} aria-label="Add a child"><Plus size={18} strokeWidth={2.8} /></button>
      </div>}
    </TopBar>
    {!demo && C.networkMismatch() && <p className="banner">⚠️ {C.networkMismatch()}</p>}

    {tab === 'home' && <main>{!kid ? noKid : <>
      <section className="card summary">
        <div className="sum-ava" aria-hidden="true">{kid.avatar}</div>
        <div className="ri-main"><b className="sum-name">{kid.name}</b>
          <small>{kid.coins} coins · ⭐ {kid.points ?? 0} point{kid.points === 1 ? '' : 's'} · {bal == null ? 'reading chain…' : bal < 0 ? 'chain unavailable' : `${bal.toFixed(2)} NIM in Piggy`}</small>
          <div className="row"><span className="chip sun">{nameTag(kid).emoji} {nameTag(kid).title}</span>{streakDays(kid) > 0 && <span className="chip plain">🔥 {streakDays(kid)}-day streak</span>}
            <span className={'chip ' + (kid.linked ? 'green' : 'amber')}>{kid.linked ? 'Linked to you' : linkSent ? 'Link pending' : 'Not linked yet'}</span></div></div>
      </section>
      <section className="card"><h2>Needs you{inbox > 0 && <span className="count">{inbox}</span>}</h2>
        {done.map(x => <div className="row-item" key={x.id}><span className="qe">{x.emoji}</span><div className="ri-main"><b>{x.title}</b><small>{kid.name} says it's done · {x.coins} coins = {x.coins * C.NIM_PER_COIN} NIM</small></div>
          <button className="go" disabled={!!busy} onClick={() => payQuest(kid, x)}>{busy ? 'Paying…' : linkSent ? 'Pay' : 'Link & pay'}</button></div>)}
        {asked.map(x => <button className="row-item tap" key={x.id} onClick={() => review(x)}><span className="qe">🛍️</span><div className="ri-main"><b>{x.what}</b><small>Wants to spend {x.coins} coins · {x.need ? 'Need' : 'Want'}</small></div><span className="chip amber">Review</span></button>)}
        {cashAsks.map(c => <div className="row-item" key={c.id}><span className="qe">💱</span><div className="ri-main"><b>Cash in {c.points} saver points</b><small>{kid.name} saved instead of spending · {coinsText(c.points / POINTS_PER_COIN)} = {c.points / POINTS_PER_COIN * C.NIM_PER_COIN} NIM</small>
          <button className="ghost tight" onClick={() => sync([{ op: 'cashNo', kidId: kid.id, cashId: c.id }])}>Not now</button></div>
          <button className="go" disabled={!!busy} onClick={() => payCash(kid, c)}>{busy ? 'Paying…' : linkSent ? 'Pay' : 'Link & pay'}</button></div>)}
        {!inbox && <Empty art="✨">All caught up. When {kid.name} finishes a quest or asks to spend, it lands here.</Empty>}
        {!linkSent && done.length > 0 && <p className="muted fine">The first payment also links {kid.name}'s Piggy to you on-chain.</p>}
      </section>
      <div className="quick">
        <button className="quick-btn" onClick={() => setSheet('quest')}><Swords size={22} strokeWidth={2.4} />New quest</button>
        <button className="quick-btn" onClick={() => setSheet('pocket')}><Coins size={22} strokeWidth={2.4} />Pocket money</button>
        <button className="quick-btn" onClick={openKid}><Eye size={22} strokeWidth={2.4} />Kid view</button>
      </div>
    </>}</main>}

    {tab === 'quests' && <main>{!kid ? noKid : <>
      <button className="go wide" onClick={() => setSheet('quest')}><Plus size={20} strokeWidth={2.8} /> New quest for {kid.name}</button>
      {done.length > 0 && <section className="card"><h2>Ready to pay<span className="count">{done.length}</span></h2>
        {done.map(x => <div className="row-item" key={x.id}><span className="qe">{x.emoji}</span><div className="ri-main"><b>{x.title}</b><small>{x.coins} coins {naira(x.coins)}</small></div>
          <button className="go" disabled={!!busy} onClick={() => payQuest(kid, x)}>{busy ? 'Paying…' : linkSent ? 'Pay' : 'Link & pay'}</button></div>)}
      </section>}
      <section className="card"><h2>In progress</h2>
        {open.map(x => <div className="row-item" key={x.id}><span className="qe">{x.emoji}</span><div className="ri-main"><b>{x.title}</b><small>{x.coins} coins</small></div><span className="chip plain">{kid.name}'s turn</span></div>)}
        {!open.length && <Empty art="⚔️">No open quests. Add one and {kid.name} sees it right away. When {kid.name} taps "I did it!", it moves to Ready to pay.</Empty>}
      </section>
      {paid.length > 0 && <section className="card"><h2>Paid</h2>
        {paid.map(x => <div className="row-item" key={x.id}><span className="qe">{x.emoji}</span><div className="ri-main"><b>{x.title}</b><small>{kid.name} received {x.coins * C.NIM_PER_COIN} NIM{x.paidAt ? ` · ${new Date(x.paidAt).toLocaleDateString()}` : ''}</small></div>
          {x.tx && !x.tx.startsWith('demo') ? <a className="chip green" href={C.txUrl(x.tx)} target="_blank">View</a> : <span className="chip green">Paid</span>}</div>)}
      </section>}
    </>}</main>}

    {tab === 'money' && <main>{!kid ? noKid : <>
      <section className="card"><h2>{kid.name}'s Piggy</h2>
        <div className="stat"><b>{bal == null ? '…' : bal < 0 ? '—' : bal.toFixed(2)}</b><span>NIM on-chain</span></div>
        <code className="addr">{kid.jar}</code>
        <p className="muted fine">{kid.custody === 'app-key' ? 'Key kept on this phone.' : 'Your own wallet address.'}</p>
        {kid.linked ? <p className="okline"><Link2 size={18} strokeWidth={2.6} /> Linked to you on-chain {kid.linkTx && kid.linkTx !== 'demo' && <a href={C.txUrl(kid.linkTx)} target="_blank">view</a>}</p>
          : <><p className="muted fine">{kid.linkTx ? '⏳ Link sent, checking the chain…' : <>Not linked yet. Your first payment to {kid.name} links the Piggy to you (memo <code>{C.linkMemo(kid.id)}</code>), or link now with 1 NIM. The first link decides the Piggy's grown-up.</>}</p>
            {kid.linkTx ? <button className="pill" onClick={check}>Check link</button> : <button className="pill" disabled={!!busy} onClick={link}><Link2 size={18} strokeWidth={2.6} /> Link Piggy (1 NIM)</button>}</>}
      </section>
      <button className="go wide" onClick={() => setSheet('pocket')}><Coins size={20} strokeWidth={2.6} /> Send pocket money</button>
      <section className="card"><h2>Spending</h2>
        {approved.map(x => <div className="row-item" key={x.id}><span className="qe">🛍️</span><div className="ri-main"><b>{x.what}</b><small>{x.coins} coins · waiting for {kid.name} to break the bank</small></div><span className="chip green">Approved</span></div>)}
        {breaks.map(b => <button className="row-item tap" key={b.tx} onClick={() => showReceipt(kid, b)}><span className="qe">🧾</span><div className="ri-main"><b>{b.what}</b><small>{new Date(b.at).toLocaleDateString()} · {b.nim} NIM to you</small></div><span className="chip plain">Receipt</span></button>)}
        {!approved.length && !breaks.length && <Empty art="🧾">When {kid.name} breaks the bank for something you approved, the receipt shows up here.</Empty>}
      </section>
      {fam.log.length > 0 && <section className="card"><h2>Payments</h2>{fam.log.slice(0, 12).map((l, i) => <p key={i} className="logline">{l}</p>)}</section>}
    </>}</main>}

    {tab === 'family' && <main>
      {kid ? <>
        <section className="card"><h2>{kid.avatar} {kid.name}'s phone</h2>
          <p className="muted fine">Open {kid.name}'s Piggy on their own phone.</p>
          <div className="list">
            <button className="row-item tap" onClick={() => openQr('phone')}><Smartphone size={22} className="ri-ic" /><div className="ri-main"><b>Kid's phone QR</b><small>Shows only {kid.name}'s Piggy, no wallet</small></div></button>
            {hasKey && <button className="row-item tap" onClick={() => openQr('key')}><KeyRound size={22} className="ri-ic" /><div className="ri-main"><b>Login key QR</b><small>Lets {kid.name} break the bank</small></div></button>}
            <button className="row-item tap" onClick={openKid}><Eye size={22} className="ri-ic" /><div className="ri-main"><b>Open kid view here</b><small>Hand this phone to {kid.name}</small></div></button>
          </div>
        </section>
        <section className="card"><h2>Dream</h2>
          <button className="row-item tap" onClick={() => setSheet('dream')}><span className="qe">{kid.dream.emoji}</span><div className="ri-main"><b>{kid.dream.title}</b><small>{kid.dream.coins} coins goal</small></div><span className="chip plain">Edit</span></button>
        </section>
      </> : noKid}
      <section className="card"><h2>Settings</h2>
        <label htmlFor="pin">Grown-up PIN (4 digits, this phone)</label>
        <input id="pin" inputMode="numeric" maxLength={4} value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPin(v); if (v.length === 4) localStorage.setItem(pKey, v); if (!v) localStorage.removeItem(pKey) }} />
        {kid && hasKey && <details className="disclose"><summary>Back up {kid.name}'s Piggy key</summary><p className="muted fine">⚠️ This private key controls {kid.name}'s Piggy. It is stored only on this phone. Write it down; whoever has it can spend the Piggy.</p><code className="secret">{keys()[kid.id]}</code></details>}
        <Recovery sKey={sKey} secret={secret} />
      </section>
    </main>}

    <TabBar tab={tab} setTab={setTab} tabs={[
      { id: 'home', label: 'Home', icon: Home, badge: inbox },
      { id: 'quests', label: 'Quests', icon: Swords },
      { id: 'money', label: 'Money', icon: Coins },
      { id: 'family', label: 'Family', icon: Users },
    ]} />

    {sheet === 'quest' && kid && <Sheet title={`New quest for ${kid.name}`} onClose={close}>
      <label>Quest</label>
      <div className="row"><input className="emoji-in" aria-label="Quest emoji" value={q.emoji} onChange={e => setQ({ ...q, emoji: e.target.value })} /><input placeholder="e.g. Make bed" aria-label="Quest name" value={q.title} onChange={e => setQ({ ...q, title: e.target.value })} /></div>
      <label>Reward</label>
      <div className="row fill">{[1, 2, 3, 5].map(v => <button key={v} className={'pill ' + (q.coins === v ? 'on' : '')} onClick={() => setQ({ ...q, coins: v })}>{v} 🪙</button>)}</div>
      <p className="muted fine">{q.coins} coins = {q.coins * C.NIM_PER_COIN} NIM {naira(q.coins)}</p>
      <button className="go wide" disabled={!q.title} onClick={() => { sync([{ op: 'addQuest', kidId: kid.id, quest: { id: uid(), ...q, status: 'open' } }]); setQ({ ...q, title: '' }); close(); say(`⚔️ Quest sent to ${kid.name}`) }}>Add quest</button>
    </Sheet>}

    {sheet === 'pocket' && kid && <Sheet title={`Pocket money for ${kid.name}`} onClose={close}>
      <div className="row fill">{[2, 5, 10, 20].map(v => <button key={v} className={'pill ' + (pocket === v ? 'on' : '')} onClick={() => setPocket(v)}>{v} 🪙</button>)}</div>
      <p className="muted fine">{pocket} coins = {pocket * C.NIM_PER_COIN} NIM {naira(pocket)}{!linkSent && `. This first payment also links ${kid.name}'s Piggy to you.`}</p>
      <button className="go wide" disabled={!!busy} onClick={async () => { await payKid(pocket * C.NIM_PER_COIN, `Pocket money · ${kid.name}`, tx => ({ op: 'pocket', kidId: kid.id, coins: pocket, tx }), `${kid.name}: Pocket money ${pocket}`); close() }}>{busy ? 'Sending…' : `${linkSent ? 'Send' : 'Link & send'} ${pocket} coins`}</button>
    </Sheet>}

    {sheet === 'child' && <Sheet title="Add a child" onClose={close}>
      <label htmlFor="kid-name">Name</label>
      <input id="kid-name" placeholder="Child's name" value={nk.name} onChange={e => setNk({ ...nk, name: e.target.value })} />
      <label>Avatar</label>
      <div className="avatars">{ANIMALS.map(a => <button key={a} className={'pill ' + (nk.avatar === a ? 'on' : '')} aria-label={a} onClick={() => setNk({ ...nk, avatar: a })}>{a}</button>)}</div>
      <details className="disclose"><summary>Use an existing Nimiq address instead</summary><input placeholder="NQ.. (leave empty to create a new Piggy)" aria-label="Existing Nimiq address" value={nk.paste} onChange={e => setNk({ ...nk, paste: e.target.value })} /></details>
      <button className="go wide" disabled={!nk.name.trim()} onClick={createPiggy}>Create {nk.name.trim() ? `${nk.name.trim()}'s` : 'a'} Piggy</button>
    </Sheet>}

    {(sheet === 'phone' || sheet === 'key') && kid && qr && <Sheet title={sheet === 'phone' ? `${kid.name}'s phone` : `${kid.name}'s login key`} onClose={close}>
      <div className="center"><img className="qr" src={qr} alt={sheet === 'phone' ? `QR code for ${kid.name}'s phone` : `${kid.name}'s Piggy key`} />
        <p className="muted fine">{sheet === 'phone' ? <>Scan with {kid.name}'s phone camera. It shows only {kid.name}'s Piggy, no wallet.</> : <>⚠️ {kid.name} scans this to log in and can then <b>break the bank</b>. Only show it to {kid.name}.</>}</p></div>
      <input readOnly aria-label="Link" value={sheet === 'phone' ? `${shareOrigin()}/?kid=${kid.token}` : keys()[kid.id]} onFocus={e => e.target.select()} />
    </Sheet>}

    {sheet === 'dream' && kid && <Sheet title={`${kid.name}'s dream`} onClose={close}>
      <DreamEdit kid={kid} save={d => { sync([{ op: 'setDream', kidId: kid.id, dream: d }]); close(); say('🌈 Dream saved') }} />
    </Sheet>}
  </>
}

function DreamEdit({ kid, save }: { kid: Kid; save: (d: Kid['dream']) => void }) {
  const [d, setD] = useState(kid.dream)
  return <>
    <label>Dream</label>
    <div className="row"><input className="emoji-in" aria-label="Dream emoji" value={d.emoji} onChange={e => setD({ ...d, emoji: e.target.value })} /><input aria-label="Dream name" value={d.title} onChange={e => setD({ ...d, title: e.target.value })} /></div>
    <label htmlFor="dream-coins">Goal in coins</label>
    <input id="dream-coins" type="number" inputMode="numeric" value={d.coins} onChange={e => setD({ ...d, coins: +e.target.value || 1 })} />
    <button className="go wide" onClick={() => save(d)}>Save dream</button>
  </>
}
