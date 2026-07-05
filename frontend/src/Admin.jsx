import React, { useState, useEffect } from 'react'

export default function Admin() {
  const [listings, setListings] = useState([])
  const [status, setStatus] = useState('')
  const [users, setUsers] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [audit, setAudit] = useState({})
  const [emailQueue, setEmailQueue] = useState([])
  const [modalUrl, setModalUrl] = useState(null)
  const [auditModalUser, setAuditModalUser] = useState(null)

  const [templates, setTemplates] = useState([])
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templatePreview, setTemplatePreview] = useState(null)

  useEffect(() => { fetchListings(); if (isAdmin()) { fetchUsers(); fetchWithdrawals(); fetchEmailQueue(); fetchTemplates() } }, [])

  function isAdmin() { return localStorage.getItem('isAdmin') === '1' }
  function adminHeader() { return isAdmin() ? { 'x-admin': '1' } : {} }

  async function fetchListings() {
    try {
      const res = await fetch('/api/listings')
      const data = await res.json()
      setListings(data)
    } catch (e) { setStatus('Error loading listings') }
  }

  async function deleteListing(id) { try { await fetch(`/api/listings/${id}`, { method: 'DELETE', headers: adminHeader() }); fetchListings() } catch (e) { console.error(e) } }

  async function fetchUsers() { try { const res = await fetch('/api/users', { headers: adminHeader() }); const data = await res.json(); setUsers(data) } catch (e) { console.error(e) } }

  async function fetchWithdrawals() { try { const res = await fetch('/api/withdrawals', { headers: adminHeader() }); const data = await res.json(); setWithdrawals(data) } catch (e) { console.error(e) } }

  async function approveRejectWithdrawal(id, action) { try { await fetch(`/api/withdrawals/${id}/${action}`, { method: 'POST', headers: adminHeader() }); fetchWithdrawals() } catch (e) { console.error(e) } }

  async function fetchAudit(userId) { try { const res = await fetch(`/api/users/${userId}/audit`, { headers: adminHeader() }); const data = await res.json(); setAudit(prev => ({ ...prev, [userId]: data })); setAuditModalUser(userId) } catch (e) { console.error(e) } }

  async function setKyc(userId, action) {
    try {
      let body = null
      let headers = adminHeader()
      if (action === 'reject') {
        const reason = window.prompt('Rejection reason (optional):')
        body = JSON.stringify({ reason })
        headers = { ...headers, 'Content-Type': 'application/json' }
      }
      await fetch(`/api/users/${userId}/kyc/${action}`, { method: 'POST', headers, body })
      fetchUsers()
      if (audit[userId]) fetchAudit(userId)
    } catch (e) { console.error(e) }
  }

  async function fetchEmailQueue() { try { const res = await fetch('/api/email-queue', { headers: adminHeader() }); const data = await res.json(); setEmailQueue(data) } catch (e) { console.error(e) } }

  async function sendQueuedEmail(id) { try { await fetch(`/api/email-queue/${id}/send`, { method: 'POST', headers: adminHeader() }); fetchEmailQueue() } catch (e) { console.error(e) } }

  async function fetchTemplates() { try { const res = await fetch('/api/email-templates', { headers: adminHeader() }); const data = await res.json(); setTemplates(data) } catch (e) { console.error(e) } }

  async function saveTemplate(t) {
    try {
      if (t.id) await fetch(`/api/email-templates/${t.id}`, { method: 'PUT', headers: { ...adminHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
      else await fetch('/api/email-templates', { method: 'POST', headers: { ...adminHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
      fetchTemplates()
      setEditingTemplate(null)
    } catch (e) { console.error(e) }
  }

  async function deleteTemplate(id) { try { await fetch(`/api/email-templates/${id}`, { method: 'DELETE', headers: adminHeader() }); fetchTemplates() } catch (e) { console.error(e) } }

  async function sendTemplate(id) {
    const recipient = window.prompt('Recipient email to send this template to:')
    if (!recipient) return
    try { await fetch(`/api/email-templates/${id}/send-to`, { method: 'POST', headers: { ...adminHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient }) }); fetchEmailQueue(); alert('Template queued') } catch (e) { console.error(e) }
  }

  return (
    <div className="card">
      <h1>Admin</h1>
      <p className="muted">Admin control center</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchListings}>Refresh listings</button>
          {isAdmin() && <button onClick={() => { fetchUsers(); fetchWithdrawals(); fetchEmailQueue(); fetchTemplates() }}>Refresh admin</button>}
        </div>
        <div className="muted">Listings: {listings.length}</div>
      </div>

      <section style={{ marginTop: 12 }}>
        <h2>Listings</h2>
        {listings.length === 0 ? <p>No listings</p> : (
          <div className="listings">{listings.map(it => (
            <div className="listing" key={it.id}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 38 }}><svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <circle cx="12" cy="12" r="10" fill="#FFD24C" stroke="#F2A900" strokeWidth="0.5" />
                </svg></div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{it.name}</h3>
                  <div className="muted">Amount: {it.amount}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>${Number(it.price).toFixed(2)}</div>
                  <div className="muted">ID {it.id}</div>
                </div>
              </div>
              {isAdmin() && (
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <button onClick={() => deleteListing(it.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}</div>
        )}
      </section>

      {isAdmin() && (
        <section style={{ marginTop: 12 }}>
          <h2>Users</h2>
          {users.length === 0 ? <p className="muted">No users</p> : (
            <ul>{users.map(u => (
              <li key={u.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{u.email}</strong> — {u.full_name} — <em>{u.kyc_status}</em>
                    {u.kyc_data && u.kyc_data.uploaded && (
                      <div>
                        <a href="#" onClick={async (e) => {
                          e.preventDefault()
                          try {
                            if (u.kyc_data.storage === 's3' && u.kyc_data.key) {
                              const res = await fetch('/api/object-url', {
                                method: 'POST',
                                headers: { ...adminHeader(), 'Content-Type': 'application/json' },
                                body: JSON.stringify({ key: u.kyc_data.key })
                              })
                              if (res.ok) {
                                const data = await res.json()
                                setModalUrl(data.url)
                                return
                              }
                            }
                          } catch (err) { console.warn('signed url fetch failed', err) }
                          setModalUrl(u.kyc_data.uploaded)
                        }}>View document</a>
                      </div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                      {u.kyc_status !== 'verified' && <button onClick={() => setKyc(u.id, 'approve')}>Approve</button>}
                      {u.kyc_status !== 'rejected' && <button onClick={() => setKyc(u.id, 'reject')} className="secondary">Reject</button>}
                      <button onClick={() => fetchAudit(u.id)}>View audit</button>
                    </div>
                    {audit[u.id] && (
                      <div style={{ marginTop: 8 }}>
                        <strong>Audit</strong>
                        <ul>
                          {audit[u.id].map(a => (
                            <li key={a.id}><small>{a.created_at} — {a.actor} — {a.action} {a.reason ? `: ${a.reason}` : ''}</small></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {isAdmin() && (
        <section style={{ marginTop: 12 }}>
          <h2>Withdrawals</h2>
          {withdrawals.length === 0 ? <p className="muted">No withdrawals</p> : (
            <ul>{withdrawals.map(w => (
              <li key={w.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>{w.email}</strong> requested ${w.amount} → {w.address}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveRejectWithdrawal(w.id, 'approve')}>Approve</button>
                    <button onClick={() => approveRejectWithdrawal(w.id, 'reject')} className="secondary">Reject</button>
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {isAdmin() && (
        <section style={{ marginTop: 12 }}>
          <h2>Email Queue</h2>
          <div style={{ marginBottom: 8 }}>
            <button onClick={fetchEmailQueue}>Refresh queue</button>
          </div>
          {emailQueue.length === 0 ? <p className="muted">No queued emails</p> : (
            <ul>{emailQueue.map(e => (
              <li key={e.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>{e.recipient}</strong> — {e.subject} — <span className="muted">{e.status}</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {e.status !== 'sent' && <button onClick={() => sendQueuedEmail(e.id)}>Send now</button>}
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {isAdmin() && (
        <section style={{ marginTop: 12 }}>
          <h2>Email Templates</h2>
          <div style={{ marginBottom: 8 }}>
            <button onClick={fetchTemplates}>Refresh templates</button>
            <button onClick={() => setEditingTemplate({ name: '', subject: '', body: '' })} className="secondary">New template</button>
          </div>
          {editingTemplate && (
            <div className="card">
              <h3>{editingTemplate.id ? 'Edit' : 'New'} template</h3>
              <label>Name<input value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} /></label>
              <label>Subject<input value={editingTemplate.subject} onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} /></label>
              <label>Body<textarea rows={6} value={editingTemplate.body} onChange={e => setEditingTemplate({ ...editingTemplate, body: e.target.value })} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => saveTemplate(editingTemplate)}>Save</button>
                <button onClick={() => setEditingTemplate(null)} className="secondary">Cancel</button>
              </div>
            </div>
          )}
          {templates.length === 0 ? <p className="muted">No templates</p> : (
            <ul>{templates.map(t => (
              <li key={t.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><strong>{t.name}</strong> — {t.subject}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setTemplatePreview(t)}>Preview</button>
                    <button onClick={() => setEditingTemplate(t)}>Edit</button>
                    <button onClick={() => deleteTemplate(t.id)} className="secondary">Delete</button>
                    <button onClick={() => sendTemplate(t.id)}>Send</button>
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {templatePreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }} onClick={() => setTemplatePreview(null)}>
          <div style={{ width: '80%', maxWidth: 800, background: 'white', borderRadius: 8, padding: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Preview: {templatePreview.name}</h3>
              <button onClick={() => setTemplatePreview(null)}>Close</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}><strong>Subject:</strong> {templatePreview.subject}</div>
              <div><strong>Body:</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 8, border: '1px solid #eee', padding: 12, borderRadius: 6 }}>{templatePreview.body}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setModalUrl(null)}>
          <div style={{ width: '80%', maxWidth: 900, background: 'white', borderRadius: 10, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 8, textAlign: 'right' }}><button onClick={() => setModalUrl(null)}>Close</button></div>
            <div style={{ padding: 12 }}>
              {modalUrl.endsWith('.pdf') ? (
                <iframe src={modalUrl} style={{ width: '100%', height: '70vh', border: 'none' }} title="document" />
              ) : (
                <img src={modalUrl} alt="document" style={{ maxWidth: '100%', maxHeight: '70vh' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {auditModalUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }} onClick={() => setAuditModalUser(null)}>
          <div style={{ width: '70%', maxWidth: 800, background: 'white', borderRadius: 10, padding: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Audit for {users.find(u=>u.id===auditModalUser)?.email || auditModalUser}</h3>
              <button onClick={() => setAuditModalUser(null)}>Close</button>
            </div>
            <div style={{ marginTop: 8 }}>
              {(audit[auditModalUser] || []).map(a => (
                <div key={a.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  <div style={{ fontSize: 13 }}><strong>{a.action}</strong> by {a.actor} — <span className="muted">{a.created_at}</span></div>
                  {a.reason && <div style={{ marginTop: 6 }}><em>Reason:</em> {a.reason}</div>}
                  {a.data && <div style={{ marginTop: 6 }}><em>Data:</em> <pre style={{ whiteSpace: 'pre-wrap' }}>{a.data}</pre></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
