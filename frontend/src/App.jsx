import React, { useState, useEffect } from 'react'
import Admin from './Admin'
import Dashboard from './Dashboard'
import IconCoin from './IconCoin'
import KYC from './KYC'
import Withdraw from './Withdraw'

function Home() {
  const [listings, setListings] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => { fetchListings() }, [])

  async function fetchListings() {
    try {
      const res = await fetch('/api/listings')
      const data = await res.json()
      setListings(data)
    } catch (e) {
      setStatus('Error loading listings')
    }
  }

  async function createListing(ev) {
    ev.preventDefault()
    const fd = new FormData(ev.target)
    const payload = { name: fd.get('name'), amount: parseFloat(fd.get('amount')), price: parseFloat(fd.get('price')) }
    try {
      const res = await fetch('/api/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('create_failed')
      setStatus('Created')
      ev.target.reset()
      fetchListings()
    } catch (e) {
      setStatus('Error creating listing')
    }
  }

  return (
    <main>
      <h1>Pluto Mining Exchange</h1>
      <section className="card hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Markets</h2>
          <p className="muted">Live offers on Pluto commodities — trade with confidence.</p>
        </div>
        <div className="balance">
          <small>Portfolio Value</small>
          <div style={{ fontSize: 18, fontWeight: 700 }}>$12,540.32</div>
        </div>
      </section>
      <section>
        <h2>Listings</h2>
        {listings.length === 0 ? <p>No listings</p> : (
          <div className="listings">{listings.map(it => (
            <div className="listing" key={it.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconCoin />
                <div>
                  <h3 style={{ margin: 0 }}>{it.name}</h3>
                  <div className="muted">{it.amount} units • ${Number(it.price).toFixed(2)}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button>Buy</button>
                <button className="secondary">Watch</button>
              </div>
            </div>
          ))}</div>
        )}
      </section>
      <section>
        <h2>Create Listing</h2>
        <form onSubmit={createListing}>
          <label>Name<br/><input name="name" required /></label>
          <label>Amount<br/><input name="amount" type="number" step="any" required /></label>
          <label>Price<br/><input name="price" type="number" step="any" required /></label>
          <button type="submit">Create</button>
        </form>
        <p>{status}</p>
      </section>
    </main>
  )
}

export default function App() {
  const [route, setRoute] = useState((window.location.hash.replace('#','')) || '/')

  useEffect(() => {
    const onHash = () => setRoute((window.location.hash.replace('#','')) || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div>
      <header>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconCoin size={34} />
            <h1 className="logo">Pluto Broker</h1>
          </div>
          <div className="toolbar">
            <nav>
              <a href="#/">Markets</a>
              <a href="#/dashboard">Dashboard</a>
              <a href="#/kyc">KYC</a>
              <a href="#/withdraw">Withdraw</a>
              <a href="#/admin">Admin</a>
            </nav>
            <div style={{ marginLeft: 12 }}>
              <button className="secondary" onClick={() => { const v = localStorage.getItem('isAdmin') === '1' ? '0' : '1'; localStorage.setItem('isAdmin', v); window.location.reload() }}>{localStorage.getItem('isAdmin') === '1' ? 'Admin: ON' : 'Admin: OFF'}</button>
            </div>
          </div>
        </div>
      </header>
      <main>
        {route === '/' && <Home />}
        {route === '/dashboard' && <Dashboard />}
        {route === '/kyc' && <KYC />}
        {route === '/withdraw' && <Withdraw />}
        {route === '/admin' && <Admin />}
      </main>
    </div>
  )
}
