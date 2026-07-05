import React, { useState } from 'react'

export default function Withdraw() {
  const [status, setStatus] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    const fd = new FormData(ev.target)
    const payload = { email: fd.get('email'), amount: parseFloat(fd.get('amount')), address: fd.get('address') }
    try {
      const res = await fetch('/api/withdrawals-by-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        throw new Error(err.error || 'failed')
      }
      setStatus('Withdrawal requested — pending')
      ev.target.reset()
    } catch (e) { setStatus('Error requesting withdrawal') }
  }

  return (
    <div className="card form-card">
      <h1>Withdraw</h1>
      <p className="muted">Request a withdrawal to your external address.</p>
      <form onSubmit={submit}>
        <label>Email<input name="email" type="email" required /></label>
        <label>Amount<input name="amount" type="number" step="any" required /></label>
        <label>Destination address<input name="address" required /></label>
        <div className="form-actions"><button type="submit">Request Withdrawal</button></div>
      </form>
      <p className="form-status muted">{status}</p>
    </div>
  )
}
