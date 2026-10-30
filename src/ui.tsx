import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import * as C from './chain'
import type { Break } from './model'

let actx: AudioContext | null = null
export function clink() {
  try {
    actx ??= new AudioContext()
    ;[1320, 1760, 2093].forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain(), t = actx!.currentTime + i * 0.09
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      o.connect(g).connect(actx!.destination); o.start(t); o.stop(t + 0.3)
    })
  } catch { /* */ }
}
export const api = async (url: string, init?: RequestInit) => { const r = await fetch(url, init); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j }
export function useToast() {
  const [t, setT] = useState(''); const timer = useRef(0)
  return [t, (m: string) => { setT(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setT(''), 4000) }] as const
}
export function useNgn() { const [v, setV] = useState<number | null>(null); useEffect(() => { C.nimNgn().then(setV).catch(() => {}) }, []); return (c: number) => v ? `≈ ₦${Math.round(c * C.NIM_PER_COIN * v).toLocaleString()}` : '' }

export const Toast = ({ msg }: { msg: string }) => msg ? <div className="toast" role="status">{msg}</div> : null

export function TopBar({ title, sub, right, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return <header className="topbar">
    <div className="tb-row"><div className="tb-title"><b>{title}</b>{sub && <small>{sub}</small>}</div>{right}</div>
    {children}
  </header>
}

export type Tab<T extends string> = { id: T; label: string; icon: LucideIcon; badge?: number }
export function TabBar<T extends string>({ tabs, tab, setTab }: { tabs: Tab<T>[]; tab: T; setTab: (t: T) => void }) {
  return <nav className="tabbar" aria-label="Sections">{tabs.map(t => {
    const on = tab === t.id
    return <button key={t.id} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }) }}>
      <span className="ti"><t.icon size={24} strokeWidth={on ? 2.6 : 2.2} />{!!t.badge && <i className="tbadge">{t.badge}</i>}</span>{t.label}
    </button>
  })}</nav>
}

/** Bottom sheet: closes on backdrop tap, Escape, or dragging the handle down. */
export function Sheet({ title, onClose, children }: { title?: ReactNode; onClose: () => void; children: ReactNode }) {
  const close = useRef(onClose); close.current = onClose
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    addEventListener('keydown', k); document.body.classList.add('locked')
    return () => { removeEventListener('keydown', k); document.body.classList.remove('locked') }
  }, [])
  const drag = {
    onPointerDown: (e: React.PointerEvent) => { start.current = e.clientY; (e.target as Element).setPointerCapture(e.pointerId) },
    onPointerMove: (e: React.PointerEvent) => { if (start.current != null) setDy(Math.max(0, e.clientY - start.current)) },
    onPointerUp: () => { start.current = null; if (dy > 90) close.current(); else setDy(0) },
  }
  return <div className="sheet-bg" onClick={() => close.current()}>
    <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
      style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}>
      <div className="grab" {...drag}><span /></div>
      {title && <div className="sheet-head"><h2>{title}</h2><button className="iconbtn" aria-label="Close" onClick={() => close.current()}><X size={20} strokeWidth={2.6} /></button></div>}
      {children}
    </div>
  </div>
}

export function Empty({ art, children }: { art: string; children: ReactNode }) {
  return <div className="empty"><div className="empty-art" aria-hidden="true">{art}</div><p>{children}</p></div>
}

export function Receipt({ b, name, avatar, forParent, onClose }: { b: Break; name: string; avatar: string; forParent?: boolean; onClose: () => void }) {
  const coins = b.coins ?? Math.round(b.nim / C.NIM_PER_COIN)
  const earned = b.earned || []
  const saved = coins - earned.reduce((s, q) => s + q.coins, 0)
  return <Sheet onClose={onClose}><div className="receipt">
    <div className="rhead"><div className="rbrand">🐷 Oinkly</div><b>RECEIPT</b><small className="muted">#{b.tx.slice(0, 8).toUpperCase()}</small></div>
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
  </div></Sheet>
}
