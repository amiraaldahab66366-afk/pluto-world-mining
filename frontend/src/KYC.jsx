import React, { useState } from 'react'

export default function KYC() {
  const [status, setStatus] = useState('')

  async function submit(ev) {
    ev.preventDefault()
    const form = ev.target
    const fd = new FormData(form)
    const file = form.document && form.document.files && form.document.files[0]
    // Try presigned upload first
    if (file) {
      try {
        const presign = await fetch('/api/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type }) })
        if (presign.ok) {
          const pj = await presign.json()
          // upload file to S3 via PUT
          await fetch(pj.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
          // submit kyc metadata pointing to S3 URL
          const payload = { email: fd.get('email'), full_name: fd.get('full_name'), kyc_data: { uploaded: pj.uploaded, storage: 's3', key: pj.key } }
          const res = await fetch('/api/kyc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (!res.ok) throw new Error('kyc submit failed')
          setStatus('KYC submitted — document uploaded (via S3)')
          form.reset()
          return
        }
      } catch (e) {
        // fall back to multipart below
        console.warn('presign/upload failed, falling back to multipart', e)
      }
    }

    // fallback to server-side multipart upload
    try {
      const res = await fetch('/api/kyc-upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setStatus(data.uploaded ? 'KYC submitted — document uploaded' : 'KYC submitted — pending review')
      form.reset()
    } catch (e) { setStatus('Error submitting KYC') }
  }

  return (
    <div className="card form-card">
      <h1>KYC Verification</h1>
      <p className="muted">Submit your basic details to verify your account.</p>
      <form onSubmit={submit}>
        <label>Email<input name="email" type="email" required /></label>
        <label>Full name<input name="full_name" required /></label>
        <label>ID number<input name="id_number" required /></label>
        <label>Upload ID document<input name="document" type="file" accept="image/*,application/pdf" /></label>
        <div className="form-actions"><button type="submit">Submit KYC</button></div>
      </form>
      <p className="form-status muted">{status}</p>
    </div>
  )
}
