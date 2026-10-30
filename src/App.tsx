import { useState } from 'react'
import * as C from './chain'
import { KidApp, KidJoin } from './kid'
import { ParentApp } from './parent'

export default function App() {
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('key')
  if (hashKey) return <KidJoin initialKey={hashKey} back={() => { location.replace('/') }} />
  const q = new URLSearchParams(location.search)
  const t = q.get('kid') || localStorage.getItem('oinkly-kid-token')
  if (t) { localStorage.setItem('oinkly-kid-token', t); return <KidApp token={t} /> }
  return <Onboard />
}

function Onboard() {
  const [role, setRole] = useState<'parent' | 'kid' | null>(() => sessionStorage.getItem('oinkly-parent') ? 'parent' : null)
  if (role === 'parent') return <ParentApp back={() => setRole(null)} />
  if (role === 'kid') return <KidJoin back={() => setRole(null)} />
  return <div className="screen">
    <div className="hero"><div className="brand">Oinkly</div>{C.TESTNET && <span className="chip plain">Testnet</span>}
      <div className="hero-art">🐷</div><h1>Are you a parent?</h1>
      <p className="muted">Grown-ups set up the family. Kids open their own Piggy.</p></div>
    <button className="go wide" onClick={() => setRole('parent')}>Yes, I'm a parent</button>
    <button className="pill wide" onClick={() => setRole('kid')}>No, I'm a kid</button>
  </div>
}
