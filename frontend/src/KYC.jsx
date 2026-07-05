import React, { useState } from 'react'

export default function KYC() {
  const [status, setStatus] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    const fd = new FormData(ev.target)
    // submit multipart including document
    try {
      const res = await fetch('/api/kyc-upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setStatus(data.uploaded ? 'KYC submitted — document uploaded' : 'KYC submitted — pending review')
      ev.target.reset()
    } catch (e) { setStatus('Error submitting KYC') }
  }

  return (
    <div className="card">
      <h1>KYC Verification</h1>
      <p className="muted">Submit your basic details to verify your account.</p>
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <label>Email<input name="email" type="email" required /></label>
        <label>Full name<input name="full_name" required /></label>
        <label>ID number<input name="id_number" required /></label>
        <label>Upload ID document<input name="document" type="file" accept="image/*,application/pdf" /></label>
        <button type="submit">Submit KYC</button>
      </form>
      <p className="muted">{status}</p>
    </div>
  )
}
