import React, { useState, useEffect } from 'react'

export default function Dashboard() {
  const [stats, setStats] = useState({ count: 0, totalAmount: 0, totalValue: 0 })
  const [status, setStatus] = useState('')

  useEffect(() => { computeStats() }, [])

  async function computeStats() {
    try {
      const res = await fetch('/api/listings')
      const data = await res.json()
      const count = data.length
      const totalAmount = data.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
      const totalValue = data.reduce((s, it) => s + ((parseFloat(it.amount) || 0) * (parseFloat(it.price) || 0)), 0)
      setStats({ count, totalAmount, totalValue })
    } catch (e) {
      setStatus('Error computing stats')
    }
  }

  return (
    <div>
      <section className="card page-hero">
        <div className="hero-copy">
          <h1>Dashboard</h1>
          <p className="muted">Quick marketplace overview</p>
        </div>
        <div className="summary-cards">
          <div className="summary-card">
            <strong>{stats.count}</strong>
            <div className="muted">Total listings</div>
          </div>
          <div className="summary-card">
            <strong>{stats.totalAmount}</strong>
            <div className="muted">Total amount</div>
          </div>
          <div className="summary-card">
            <strong>${Number(stats.totalValue).toFixed(2)}</strong>
            <div className="muted">Total market value</div>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Market Snapshot</h2>
        <p className="muted">Recent listings and market activity are shown on the Markets page.</p>
      </section>
      <p className="muted">{status}</p>
    </div>
  )
}
