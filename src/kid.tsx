import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Award, Hammer, Home, KeyRound, LogOut, ShoppingBag, Sparkles, Swords, Receipt as ReceiptIcon } from 'lucide-react'
import * as C from './chain'
import { addressFromPrivateKey, cleanKey, signLogin, validKey } from './keys'
import { LESSONS, POINTS_PER_COIN, POINTS_PER_QUEST, SAVER_BADGES, badgeTitle, canCollect, coinsText, collectPoints, freePoints, nameTag, streakDays, uid, type Break, type CashIn as Cash, type KidView, type KidOp, type Spend } from './model'
import { api, clink, Empty, Receipt, Sheet, TabBar, Toast, TopBar, useNgn, useToast } from './ui'

const KEY = 'oinkly-kid-key'
const SEEN = 'oinkly-kid-seen-'
export async function kidLogin(key: string) {
  const j = await api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signLogin(key)) })
  localStorage.setItem('oinkly-kid-token', j.token); localStorage.setItem(KEY, cleanKey(key))
  return j as { token: string; name: string }
}

export function KidJoin({ back, initialKey = '' }: { back: () => void; initialKey?: string }) {
  const [v, setV] = useState('')
  const [key, setKey] = useState(initialKey)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [link, setLink] = useState(false)
  const token = (() => { const s = v.trim(); try { return new URL(s).searchParams.get('kid') || '' } catch { return s } })()
  async function login(k: string) {
    setBusy(true); setErr('')
    try { await kidLogin(k); location.replace('/') } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  useEffect(() => { if (initialKey) { history.replaceState(null, '', location.pathname); if (validKey(initialKey)) login(initialKey) } }, [])
  return <div className="screen">
    <div className="hero"><div className="hero-art">🧒</div><h1>Hi there!</h1>
      <p className="muted">Log in with the <b>Piggy key</b> your grown-up made for you. Scan its QR code with this phone's camera, or paste it here.</p></div>
    <input placeholder="Paste your Piggy key" autoComplete="off" aria-label="Piggy key" value={key} onChange={e => setKey(e.target.value)} />
    <button className="go wide" disabled={!validKey(key) || busy} onClick={() => login(key)}>{busy ? 'Opening…' : 'Log in with my key'}</button>
    {err && <p className="err">😕 {err}</p>}
    <div className="stack-foot">
      <button className="ghost" onClick={() => setLink(true)}>I have a Piggy link instead</button>
      <button className="ghost" onClick={back}>← Back</button>
    </div>
    {link && <Sheet title="Open with a link" onClose={() => setLink(false)}>
      <p className="muted">Your grown-up can open <b>Kid's phone</b> and you scan that QR code, or paste the link they sent you.</p>
      <input placeholder="Paste your Piggy link" aria-label="Piggy link" value={v} onChange={e => setV(e.target.value)} />
      <button className="go wide" disabled={token.length < 16} onClick={() => { location.href = `/?kid=${encodeURIComponent(token)}` }}>Open my Piggy</button>
    </Sheet>}
  </div>
}

export function KidApp({ token }: { token: string }) {
  const [kid, setKid] = useState<KidView | null>(null)
  const [parent, setParent] = useState('')
  const [key, setKey] = useState(() => localStorage.getItem(KEY) || '')
  const [err, setErr] = useState('')
  const [toast, say] = useToast()
  const prev = useRef(-1)
  const last = useRef<KidView | null>(null)
  const [receipt, setReceipt] = useState<Break | null>(null)
  const [drop, setDrop] = useState(0)
  const naira = useNgn()
  const coinDrop = () => { setDrop(d => d + 1); clink() }
  async function load(op?: KidOp) {
    try {
      const j = await api(`/api/kid?t=${encodeURIComponent(token)}`, op ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(op) } : undefined)
      const k = j.kid as KidView, old = last.current
      const cashed = (k.cashes || []).filter(c => c.status === 'paid')
      const keys = [...k.quests.filter(q => q.status === 'paid').map(q => 'q:' + q.id), ...(k.gifts || []).map(g => 'g:' + g.tx), ...cashed.map(c => 'c:' + c.id)]
      const stored = localStorage.getItem(SEEN + k.id)
      const seen = new Set<string>(stored ? JSON.parse(stored) : keys)
      const news = [
        ...k.quests.filter(q => q.status === 'paid' && !seen.has('q:' + q.id)).map(q => `${q.coins} coins for "${q.title}" (+${POINTS_PER_QUEST} ⭐)`),
        ...(k.gifts || []).filter(g => !seen.has('g:' + g.tx)).map(g => `${g.coins} coins of pocket money 💸`),
        ...cashed.filter(c => !seen.has('c:' + c.id)).map(c => `${coinsText(c.points / POINTS_PER_COIN)} for your ${c.points} saver points 💱`),
      ]
      localStorage.setItem(SEEN + k.id, JSON.stringify(keys))
      if (news.length) { coinDrop(); say(`🎉 Your grown-up sent you ${news.join(' and ')}!`) }
      else if (prev.current >= 0 && k.coins + k.seeds > prev.current) { coinDrop(); say('🪙 Coins arrived in your Piggy!') }
      const newL = old && k.lessons.find(l => !old.lessons.includes(l)); if (newL) setTimeout(() => say(`🏅 New badge: ${badgeTitle(newL)}!`), 900)
      const newTag = old && nameTag(k).title !== nameTag(old).title; if (newTag) setTimeout(() => say(`${nameTag(k).emoji} New name tag: ${nameTag(k).title}!`), 1800)
      prev.current = k.coins + k.seeds; last.current = k; setKid(k); setParent(j.parent); setErr('')
    } catch (e) { setErr(String((e as Error).message)) }
  }
  useEffect(() => { load(); const i = setInterval(() => load(), 10_000); return () => clearInterval(i) }, [token])
  const logout = () => { localStorage.removeItem('oinkly-kid-token'); localStorage.removeItem(KEY); location.href = '/' }
  async function addKey(k: string) {
    try { const j = await kidLogin(k); if (j.token !== token) return logout(); setKey(cleanKey(k)); say('🔑 Key added!') }
    catch (e) { say('😕 ' + (e as Error).message) }
  }
  if (!kid) return <div className="screen"><div className="hero"><div className="hero-art">🐷</div>
    {err ? <><p>😕 {err}</p><button className="pill" onClick={logout}>Start over</button></> : <p className="muted">Opening your Piggy…</p>}</div></div>
  const act = async (op: KidOp, msg?: string) => { await load(op); if (msg) say(msg) }
  async function broke(s: Spend, tx: string, nim: number) {
    coinDrop()
    await act({ op: 'broke', brk: { at: Date.now(), what: s.what, nim, to: 'grown-up', tx, spendId: s.id } }, `🔨 CRASH! ${s.coins} coins sent for your ${s.what}!`)
    const b = last.current?.breaks?.find(x => x.tx === tx); if (b) setReceipt(b)
  }
  return <>
    <KidScreen kid={kid} toast={toast} drop={drop} coinDrop={coinDrop} naira={naira} act={act}
      corner={<button className="iconbtn" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={20} strokeWidth={2.4} /></button>}
      breakBank={<BreakBank kid={kid} parent={parent} keyHex={key} onKey={addKey} onBroke={broke} />}
      receipts={<Receipts kid={kid} onReceipt={setReceipt} />} />
    {receipt && <Receipt b={receipt} name={kid.name} avatar={kid.avatar} onClose={() => setReceipt(null)} />}
  </>
}

function Receipts({ kid, onReceipt }: { kid: KidView; onReceipt: (b: Break) => void }) {
  const receipts = (kid.breaks || []).slice(-5).reverse()
  if (!receipts.length) return null
  return <section className="card"><h2>My receipts</h2>
    {receipts.map(b => <button key={b.tx} className="row-item tap" onClick={() => onReceipt(b)}><span className="qe">🧾</span><div className="ri-main"><b>{b.what}</b><small>{new Date(b.at).toLocaleDateString()} · {b.coins ?? Math.round(b.nim / C.NIM_PER_COIN)} coins</small></div><ReceiptIcon size={20} className="chev" /></button>)}
  </section>
}

function BreakBank({ kid, parent, keyHex, onKey, onBroke }: { kid: KidView; parent: string; keyHex: string; onKey: (k: string) => void; onBroke: (s: Spend, tx: string, nim: number) => Promise<void> }) {
  const [bal, setBal] = useState<number | null>(null)
  const [sure, setSure] = useState<Spend | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [addKey, setAddKey] = useState(false)
  const [k, setK] = useState('')
  useEffect(() => {
    if (!keyHex) return
    const read = () => C.jarBalanceNim(addressFromPrivateKey(keyHex)).then(setBal).catch(() => setBal(-1))
    read(); const i = setInterval(read, 20_000); return () => clearInterval(i)
  }, [keyHex])
  const approved = kid.spends.filter(s => s.status === 'ok')
  async function smash(s: Spend) {
    setBusy(true); setErr('')
    try {
      const nim = s.coins * C.NIM_PER_COIN
      const r = await C.breakBank(keyHex, parent, nim, `Oinkly: ${kid.name} broke the bank for ${s.what}`)
      setBal(b => b != null && b >= 0 ? b - nim : b); setSure(null)
      await onBroke(s, r.hash, nim)
    } catch (e) { setErr(C.errMsg(e)) } finally { setBusy(false) }
  }
  return <>
    {approved.length > 0 && <section className="card ready">
      <h2>Ready to break</h2>
      <p className="muted">Your grown-up said yes! Break the bank to send them the coins so they can buy it.</p>
      {approved.map(s => <div className="row-item" key={s.id}><span className="qe">🛍️</span><div className="ri-main"><b>{s.what}</b><small>{s.coins} coins</small></div>
        <button className="go" onClick={() => keyHex ? (setErr(''), setSure(s)) : setAddKey(true)}><Hammer size={18} strokeWidth={2.6} /> Break</button></div>)}
    </section>}
    {sure && <Sheet onClose={() => !busy && setSure(null)}>
      <div className="center">
        <div className="hero-art smash" aria-hidden="true">🐷</div>
        <h2>Break the bank for your {sure.what}?</h2>
        <p className="muted">{sure.coins} coins go to your grown-up so they can buy it.{bal != null && bal >= 0 && ` Your Piggy holds ${Math.round(bal / C.NIM_PER_COIN * 10) / 10} coins.`}</p>
        {err && <p className="err">⚠️ {err}</p>}
        <button className="go wide" disabled={busy || !C.validAddr(parent)} onClick={() => smash(sure)}>{busy ? 'Breaking…' : `Yes! Send ${sure.coins} coins`}</button>
        <button className="ghost wide" disabled={busy} onClick={() => setSure(null)}>Not yet, keep saving</button>
      </div>
    </Sheet>}
    {addKey && <Sheet title="Add your Piggy key" onClose={() => setAddKey(false)}>
      <p className="muted">To break your Piggy, add the Piggy key your grown-up gave you. Scan its QR code or paste it.</p>
      <input placeholder="Paste your Piggy key" autoComplete="off" aria-label="Piggy key" value={k} onChange={e => setK(e.target.value)} />
      <button className="go wide" disabled={!validKey(k)} onClick={() => { onKey(k); setAddKey(false) }}><KeyRound size={18} strokeWidth={2.6} /> Add my key</button>
    </Sheet>}
  </>
}

type KidTab = 'home' | 'quests' | 'spend' | 'saver'
const STATUS: Record<Spend['status'], [string, string]> = { asked: ['Waiting', 'amber'], ok: ['Yes!', 'green'], spent: ['Done', 'plain'], no: ['Not now', 'plain'] }
const CASH: Record<Cash['status'], [string, string]> = { asked: ['Waiting', 'amber'], paid: ['Paid in NIM', 'green'], no: ['Not now', 'plain'] }

export function KidScreen({ kid, toast, drop, coinDrop, naira, act, corner, breakBank, receipts }: { kid: KidView; toast: string; drop: number; coinDrop: () => void; naira: (c: number) => string; act: (op: KidOp, msg?: string) => void; corner?: ReactNode; breakBank?: ReactNode; receipts?: ReactNode }) {
  const [tab, setTab] = useState<KidTab>('home')
  const [ask, setAsk] = useState(false)
  const total = kid.coins + kid.seeds
  const pct = Math.min(100, Math.round((total / kid.dream.coins) * 100))
  const [cash, setCash] = useState(false)
  const tag = nameTag(kid), streak = streakDays(kid), points = kid.points ?? 0, spare = freePoints(kid)
  const collectBtn = <button className="go wide" disabled={!canCollect(kid)} onClick={() => { const n = collectPoints(kid); coinDrop(); act({ op: 'harvest' }, `⭐ +${n} saver points for saving!`) }}>
    {canCollect(kid) ? `Collect ${collectPoints(kid)} points ⭐` : kid.coins < 1 ? 'Save some coins first' : 'Come back tomorrow 🌙'}</button>
  const todo = kid.quests.filter(q => q.status !== 'paid')
  const earned = [
    ...kid.quests.filter(q => q.status === 'paid').map(q => ({ key: q.id, emoji: q.emoji, title: q.title, coins: q.coins, at: q.paidAt || 0 })),
    ...(kid.gifts || []).map(g => ({ key: g.tx, emoji: '💸', title: 'Pocket money', coins: g.coins, at: g.at })),
  ].sort((a, b) => b.at - a.at)
  const free = kid.coins - kid.spends.filter(s => s.status === 'ok').reduce((t, s) => t + s.coins, 0)
  const approved = kid.spends.filter(s => s.status === 'ok').length
  const earnedRows = (n: number) => <>{earned.slice(0, n).map(e => <div className="row-item" key={e.key}><span className="qe">{e.emoji}</span><div className="ri-main"><b>{e.title}</b>{e.at > 0 && <small>{new Date(e.at).toLocaleDateString()}</small>}</div><span className="plus">+{e.coins}</span></div>)}</>
  return <div className="app">
    <Toast msg={toast} />
    <TopBar title={<>{kid.avatar} {kid.name}'s Piggy</>} right={corner} />
    {tab === 'home' && <main>
      <section className="card piggy">
        <button className="jar" onClick={coinDrop} aria-label="Shake your Piggy"><div className="pig bounce" key={drop}>🐷</div>{drop > 0 && <div className="coin fall" key={'c' + drop}>🪙</div>}</button>
        <div className="big">{kid.coins}<span> coins</span></div>
        <div className="muted">⭐ {points} saver point{points === 1 ? '' : 's'}{streak > 0 && ` · 🔥 ${streak}-day streak`}{naira(total) && ` · ${naira(total)}`}</div>
        <button className="tagchip" onClick={() => setTab('saver')}>{tag.emoji} {tag.title}</button>
      </section>
      <section className="card"><h2>My dream</h2>
        <div className="dreamrow"><div className="dreamimg" style={{ filter: `grayscale(${100 - pct}%)` }}>{kid.dream.emoji}</div>
          <div className="ri-main"><b>{kid.dream.title}</b><div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ '--p': pct + '%' } as React.CSSProperties} /></div><small>{total} of {kid.dream.coins} coins · {pct}%</small></div></div>
      </section>
      {todo.some(q => q.status === 'open') && <button className="card nudge" onClick={() => setTab('quests')}>⚔️ <b>{todo.filter(q => q.status === 'open').length} quest{todo.filter(q => q.status === 'open').length > 1 ? 's' : ''} to do</b><span>Earn coins →</span></button>}
      <section className="card"><h2>Saver points</h2>
        <p className="muted">Keep your coins in Piggy instead of breaking it, and they grow points every day. {streak >= 7 ? '🔥 Week streak: your points grow 2×!' : `Save ${7 - streak} more day${7 - streak > 1 ? 's' : ''} in a row for 2× points.`}</p>
        {collectBtn}
      </section>
      {earned.length > 0 && <section className="card"><h2>Just arrived</h2>{earnedRows(3)}</section>}
    </main>}
    {tab === 'quests' && <main>
      <section className="card"><h2>To do</h2>
        {todo.map(q => <div className="row-item" key={q.id}><span className="qe">{q.emoji}</span><div className="ri-main"><b>{q.title}</b><small>+{q.coins} coins</small></div>
          {q.status === 'open' ? <button className="go" onClick={() => act({ op: 'questDone', questId: q.id }, '🎉 Great job! Waiting for your grown-up to pay.')}>I did it!</button> : <span className="chip amber">Waiting for pay</span>}</div>)}
        {!todo.length && <Empty art="🏆">No quests right now. Ask your grown-up for a new one!</Empty>}
      </section>
      <section className="card"><h2>Coins I earned</h2>
        {earned.length ? earnedRows(10) : <Empty art="🪙">Finish a quest and your coins show up here.</Empty>}
      </section>
    </main>}
    {tab === 'spend' && <main>
      {breakBank}
      <section className="card spend-head">
        <div><b className="big-sm">{free}</b> <span className="muted">coins you can spend</span></div>
        <button className="go wide" onClick={() => setAsk(true)}><ShoppingBag size={20} strokeWidth={2.6} /> Ask to spend</button>
      </section>
      <section className="card"><h2>My wishes</h2>
        {kid.spends.length ? kid.spends.slice(-8).reverse().map(sp => <div className="row-item" key={sp.id}><span className="qe">{sp.need ? '🍎' : '🎮'}</span><div className="ri-main"><b>{sp.what}</b><small>{sp.coins} coins · {sp.need ? 'Need' : 'Want'}</small></div><span className={'chip ' + STATUS[sp.status][1]}>{STATUS[sp.status][0]}</span></div>)
          : <Empty art="🛍️">Want something? Ask your grown-up, and decide: is it a Need or a Want?</Empty>}
      </section>
      {receipts}
    </main>}
    {tab === 'saver' && <main>
      <section className="nametag" aria-label="My name tag">
        <div className="nt-band">{tag.emoji} {tag.title}</div>
        <div className="nt-body">
          <div className="nt-ava" aria-hidden="true">{kid.avatar}</div>
          <div className="nt-name">{kid.name}</div>
          {tag.next ? <><div className="bar" role="progressbar" aria-valuenow={tag.points} aria-valuemin={0} aria-valuemax={tag.next.at}><div style={{ '--p': Math.round((tag.points - tag.at) / (tag.next.at - tag.at) * 100) + '%' } as React.CSSProperties} /></div>
            <small>{tag.next.at - tag.points} more points to become {tag.next.emoji} {tag.next.title}</small></> : <small>The top saver tag. Amazing! 👑</small>}
        </div>
      </section>
      <section className="card"><h2>My points</h2>
        <div className="stat"><b>{points}</b><span>⭐ saver points</span></div>
        <p className="muted fine">{POINTS_PER_COIN} points = 1 coin = {C.NIM_PER_COIN} NIM{streak > 0 && ` · 🔥 ${streak}-day saving streak`}</p>
        {collectBtn}
        <button className="pill wide" disabled={spare < POINTS_PER_COIN} onClick={() => setCash(true)}><Sparkles size={18} strokeWidth={2.6} /> Turn points into NIM</button>
        {(kid.cashes || []).slice(-3).reverse().map(c => <div className="row-item" key={c.id}><span className="qe">💱</span><div className="ri-main"><b>{c.points} points</b><small>{coinsText(c.points / POINTS_PER_COIN)} = {c.points / POINTS_PER_COIN * C.NIM_PER_COIN} NIM</small></div><span className={'chip ' + CASH[c.status][1]}>{CASH[c.status][0]}</span></div>)}
        <p className="muted fine">Earn {POINTS_PER_QUEST} points for every quest, plus daily points for the coins you keep. Breaking the bank starts your streak again.</p>
      </section>
      <section className="card"><h2>Saver badges</h2>
        {SAVER_BADGES.map(b => { const on = kid.lessons.includes(b.id); return <div key={b.id} className={'badge ' + (on ? 'got' : 'locked')}><div className="be">{on ? b.emoji : '🔒'}</div><div><b>{b.title}</b><div className="muted">{on ? b.line : b.need}</div></div></div> })}
      </section>
      <section className="card"><h2>Money lessons</h2>
        {LESSONS.map(l => { const on = kid.lessons.includes(l.id); return <div key={l.id} className={'badge ' + (on ? 'got' : 'locked')}><div className="be">{on ? l.emoji : '🔒'}</div><div><b>{l.title}</b><div className="muted">{on ? l.line : `Unlocks at ${l.at} coins`}</div></div></div> })}
      </section>
    </main>}
    <TabBar tab={tab} setTab={setTab} tabs={[
      { id: 'home', label: 'Piggy', icon: Home },
      { id: 'quests', label: 'Quests', icon: Swords, badge: todo.filter(q => q.status === 'open').length },
      { id: 'spend', label: 'Spend', icon: ShoppingBag, badge: approved },
      { id: 'saver', label: 'Saver', icon: Award, badge: canCollect(kid) ? 1 : 0 },
    ]} />
    {cash && <Sheet title="Turn points into NIM" onClose={() => setCash(false)}>
      <CashIn spare={spare} onAsk={p => { setCash(false); act({ op: 'cashIn', id: uid(), points: p }, '📨 Sent! Your grown-up pays you with Nimiq Pay.') }} />
    </Sheet>}
    {ask && <Sheet title="Ask to spend" onClose={() => setAsk(false)}>
      <AskSpend coins={free} onAsk={(what, coins, need) => { setAsk(false); act({ op: 'ask', spend: { id: uid(), what, coins, need, status: 'asked' } }, '📨 Sent to your grown-up!') }} />
    </Sheet>}
  </div>
}

function CashIn({ spare, onAsk }: { spare: number; onAsk: (points: number) => void }) {
  const all = Math.floor(spare / POINTS_PER_COIN) * POINTS_PER_COIN
  const opts = [...new Set([10, 20, 50, 100, all])].filter(v => v >= POINTS_PER_COIN && v <= all).sort((a, b) => a - b)
  const [p, setP] = useState(opts[0] ?? 0)
  const coins = p / POINTS_PER_COIN
  return <>
    <p className="muted">Saving earned you points. Your grown-up turns them into real NIM in your Piggy with Nimiq Pay.</p>
    <label>How many points?</label>
    <div className="row fill">{opts.map(v => <button key={v} className={'pill ' + (p === v ? 'on' : '')} onClick={() => setP(v)}>{v === all && opts.length > 1 ? `All ${v}` : v} ⭐</button>)}</div>
    <div className="facts"><span>{p}<small>points</small></span><span>{coins}<small>{coins === 1 ? 'coin' : 'coins'}</small></span><span>{coins * C.NIM_PER_COIN}<small>NIM</small></span></div>
    <button className="go wide" disabled={!p} onClick={() => onAsk(p)}>Ask my grown-up</button>
  </>
}

function AskSpend({ coins, onAsk }: { coins: number; onAsk: (w: string, c: number, n: boolean) => void }) {
  const [what, setWhat] = useState(''); const [c, setC] = useState(3); const [need, setNeed] = useState<boolean | null>(null)
  return <>
    <label htmlFor="ask-what">What do you want?</label>
    <input id="ask-what" placeholder="e.g. Lego set" value={what} onChange={e => setWhat(e.target.value)} />
    <label>How many coins?</label>
    <div className="row fill">{[1, 3, 5, 10].map(v => <button key={v} className={'pill ' + (c === v ? 'on' : '')} onClick={() => setC(v)}>{v} 🪙</button>)}</div>
    <label>Is it a Need or a Want?</label>
    <div className="row fill"><button className={'pill ' + (need === true ? 'on' : '')} onClick={() => setNeed(true)}>🍎 Need</button><button className={'pill ' + (need === false ? 'on' : '')} onClick={() => setNeed(false)}>🎮 Want</button></div>
    <button className="go wide" disabled={!what || need === null || c > coins} onClick={() => onAsk(what, c, !!need)}>{c > coins ? `Not enough coins yet (you have ${coins})` : 'Ask my grown-up'}</button>
  </>
}
