const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'data.db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs')
const multer = require('multer')
let nodemailer
try { nodemailer = require('nodemailer') } catch (e) { nodemailer = null }
// optional AWS S3 presign support
let s3Client, getSignedUrl, PutObjectCommand, GetObjectCommand
try {
  const { S3Client, PutObjectCommand: PutCmd, GetObjectCommand: GetCmd } = require('@aws-sdk/client-s3')
  getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl
  PutObjectCommand = PutCmd
  GetObjectCommand = GetCmd
  // s3Client will be created lazily when env vars available
} catch (e) {
  // AWS SDK not installed, presign endpoints will return 501
  s3Client = null
  getSignedUrl = null
  PutObjectCommand = null
}

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) console.error('Failed to open database:', err);
});

// ensure upload dir exists
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const KYC_DIR = path.join(UPLOADS_DIR, 'kyc')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR)
if (!fs.existsSync(KYC_DIR)) fs.mkdirSync(KYC_DIR)

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, KYC_DIR) },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    const basename = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '_')
    cb(null, `${Date.now()}_${basename}${ext}`)
  }
})
const upload = multer({ storage })

// serve uploads
app.use('/uploads', express.static(UPLOADS_DIR))

function requireAdmin(req, res, next) {
  const isAdmin = req.get('x-admin') === '1' || req.get('x-admin') === 'true'
  if (!isAdmin) return res.status(403).json({ error: 'admin_required' })
  next()
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/listings', (req, res) => {
  db.all('SELECT id, name, amount, price FROM listings ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

app.post('/api/listings', (req, res) => {
  const { name, amount, price } = req.body;
  if (!name || amount == null || price == null) return res.status(400).json({ error: 'invalid_payload' });
  const stmt = db.prepare('INSERT INTO listings (name, amount, price) VALUES (?, ?, ?)');
  stmt.run(name, amount, price, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.status(201).json({ id: this.lastID, name, amount, price });
  });
  stmt.finalize();
});

// Admin: delete a listing
app.delete('/api/listings/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  db.run('DELETE FROM listings WHERE id = ?', id, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json({ deleted: this.changes })
  })
})

// KYC submission
app.post('/api/kyc', (req, res) => {
  const { email, full_name, kyc_data } = req.body
  if (!email || !full_name) return res.status(400).json({ error: 'invalid_payload' })
  const stmt = db.prepare('INSERT OR IGNORE INTO users (email, full_name, kyc_status, kyc_data) VALUES (?, ?, ?, ?)')
  stmt.run(email, full_name, 'pending', JSON.stringify(kyc_data || {}), function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    // update existing if already exists
    db.run('UPDATE users SET kyc_status = ?, kyc_data = ? WHERE email = ?', 'pending', JSON.stringify(kyc_data || {}), email)
    res.json({ ok: true })
  })
  stmt.finalize()
})

// KYC with file upload
app.post('/api/kyc-upload', upload.single('document'), (req, res) => {
  const { email, full_name } = req.body
  if (!email || !full_name) return res.status(400).json({ error: 'invalid_payload' })
  const file = req.file
  const kycData = { uploaded: file ? `/uploads/kyc/${file.filename}` : null }
  const stmt = db.prepare('INSERT OR IGNORE INTO users (email, full_name, kyc_status, kyc_data) VALUES (?, ?, ?, ?)')
  stmt.run(email, full_name, 'pending', JSON.stringify(kycData), function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    db.run('UPDATE users SET kyc_status = ?, kyc_data = ? WHERE email = ?', 'pending', JSON.stringify(kycData), email, function (uerr) {
      if (uerr) return res.status(500).json({ error: 'db_error' })
      // record audit entry
      db.get('SELECT id FROM users WHERE email = ?', email, (err2, row) => {
        if (row) {
          const aid = db.prepare('INSERT INTO kyc_audit (user_id, action, actor, reason, data) VALUES (?, ?, ?, ?, ?)')
          aid.run(row.id, 'submitted', 'user', null, JSON.stringify(kycData), () => { aid.finalize() })
          // try to notify user
          sendEmailIfConfigured(email, 'KYC submitted', 'Your KYC has been submitted and is pending review.')
        }
        res.json({ ok: true, uploaded: kycData.uploaded })
      })
    })
  })
  stmt.finalize()
})

// Provide presigned S3 URL for direct uploads (optional). Expects JSON { filename, contentType }
app.post('/api/upload-url', express.json(), async (req, res) => {
  const { filename, contentType } = req.body || {}
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
  if (!filename || !contentType) return res.status(400).json({ error: 'missing_params' })
  if (!bucket || !region || !getSignedUrl || !PutObjectCommand) return res.status(501).json({ error: 's3_not_configured' })
  try {
    // create client if not created
    if (!s3Client) s3Client = new (require('@aws-sdk/client-s3').S3Client)({ region })
    const key = `kyc/${Date.now()}_${filename.replace(/[^a-z0-9-_.]/gi, '_')}`
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ACL: 'private' })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 900 })
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    res.json({ url, key, uploaded: publicUrl })
  } catch (e) {
    console.error('presign error', e)
    res.status(500).json({ error: 'presign_failed' })
  }
})

// Admin-only: generate signed GET URL for private S3 objects
app.get('/api/object-url', requireAdmin, async (req, res) => {
  const key = req.query.key
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
  if (!key) return res.status(400).json({ error: 'missing_key' })
  if (!bucket || !region || !getSignedUrl || !GetObjectCommand) return res.status(501).json({ error: 's3_not_configured' })
  try {
    if (!s3Client) s3Client = new (require('@aws-sdk/client-s3').S3Client)({ region })
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3Client, cmd, { expiresIn: 900 })
    res.json({ url })
  } catch (e) {
    console.error('signed get error', e)
    res.status(500).json({ error: 'sign_failed' })
  }
})

// email helper: uses nodemailer if configured, otherwise logs
function sendEmailIfConfigured(to, subject, text) {
  // enqueue email for background delivery
  const qstmt = db.prepare('INSERT INTO email_queue (recipient, subject, body) VALUES (?, ?, ?)')
  qstmt.run(to, subject, text, function (err) {
    if (err) console.error('queue email error', err)
  })
  qstmt.finalize()
}

// process queue: send pending emails (up to batchSize) using nodemailer if configured, otherwise log and mark sent
async function processEmailQueue(batchSize = 5) {
  db.all("SELECT * FROM email_queue WHERE status = 'pending' AND (available_at IS NULL OR available_at <= datetime('now')) ORDER BY queued_at LIMIT ?", [batchSize], (err, rows) => {
    if (err || !rows || rows.length === 0) return;
    rows.forEach(r => {
      // mark as sending (optimistic)
      db.run('UPDATE email_queue SET status = ?, attempts = attempts + 1 WHERE id = ?', 'sending', r.id)
      if (nodemailer && process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: !!process.env.SMTP_SECURE,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        })
        transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@plutobroker', to: r.recipient, subject: r.subject, text: r.body }).then(info => {
          db.run('UPDATE email_queue SET status = ?, sent_at = ? WHERE id = ?', 'sent', new Date().toISOString(), r.id);
        }).catch(e => {
          // retry/backoff logic
          const attempts = (r.attempts || 0) + 1;
          if (attempts >= 5) {
            db.run('UPDATE email_queue SET status = ?, error = ?, attempts = ? WHERE id = ?', 'failed', String(e), attempts, r.id);
          } else {
            const backoff = Math.min(3600, Math.pow(2, attempts) * 30); // seconds
            const next = new Date(Date.now() + backoff * 1000).toISOString();
            db.run('UPDATE email_queue SET status = ?, error = ?, attempts = ?, available_at = ? WHERE id = ?', 'pending', String(e), attempts, next, r.id);
          }
          console.error('email send error', e);
        });
      } else {
        console.log('Email (simulated send) ->', r.recipient, r.subject)
        db.run('UPDATE email_queue SET status = ?, sent_at = ? WHERE id = ?', 'sent', new Date().toISOString(), r.id)
      }
    })
  })
}

// start background worker every 10s
setInterval(() => processEmailQueue(10), 10000)

// Admin endpoints to view/send queued emails
app.get('/api/email-queue', requireAdmin, (req, res) => {
  db.all('SELECT * FROM email_queue ORDER BY queued_at DESC LIMIT 200', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json(rows)
  })
})

app.post('/api/email-queue/:id/send', requireAdmin, (req, res) => {
  const id = req.params.id
  db.get('SELECT * FROM email_queue WHERE id = ?', id, (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'not_found' })
    // trigger immediate attempt
    if (nodemailer && process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: !!process.env.SMTP_SECURE,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      })
      transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@plutobroker', to: row.recipient, subject: row.subject, text: row.body }).then(() => {
        db.run('UPDATE email_queue SET status = ?, sent_at = ? WHERE id = ?', 'sent', new Date().toISOString(), id)
        res.json({ ok: true })
      }).catch(e => {
        db.run('UPDATE email_queue SET status = ?, error = ? WHERE id = ?', 'failed', String(e), id)
        res.status(500).json({ error: 'send_failed' })
      })
    } else {
      console.log('Email (admin triggered simulated) ->', row.recipient, row.subject)
      db.run('UPDATE email_queue SET status = ?, sent_at = ? WHERE id = ?', 'sent', new Date().toISOString(), id)
      res.json({ ok: true })
    }
  })
})

// Email templates CRUD
app.get('/api/email-templates', requireAdmin, (req, res) => {
  db.all('SELECT * FROM email_templates ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json(rows)
  })
})

app.post('/api/email-templates', requireAdmin, (req, res) => {
  const { name, subject, body } = req.body
  if (!name || !subject || !body) return res.status(400).json({ error: 'invalid_payload' })
  const stmt = db.prepare('INSERT INTO email_templates (name, subject, body) VALUES (?, ?, ?)')
  stmt.run(name, subject, body, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json({ id: this.lastID })
  })
  stmt.finalize()
})

app.put('/api/email-templates/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  const { name, subject, body } = req.body
  db.run('UPDATE email_templates SET name = ?, subject = ?, body = ? WHERE id = ?', name, subject, body, id, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json({ updated: this.changes })
  })
})

app.delete('/api/email-templates/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  db.run('DELETE FROM email_templates WHERE id = ?', id, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json({ deleted: this.changes })
  })
})

// Send template to a recipient (enqueue)
app.post('/api/email-templates/:id/send-to', requireAdmin, (req, res) => {
  const id = req.params.id
  const { recipient, vars } = req.body
  if (!recipient) return res.status(400).json({ error: 'missing_recipient' })
  db.get('SELECT subject, body FROM email_templates WHERE id = ?', id, (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'not_found' })
    let subject = row.subject
    let body = row.body
    // simple templating: replace {{key}} with vars[key]
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(k => {
        const re = new RegExp('{{\\s*' + k + '\\s*}}', 'g')
        subject = subject.replace(re, vars[k])
        body = body.replace(re, vars[k])
      })
    }
    const qstmt = db.prepare('INSERT INTO email_queue (recipient, subject, body) VALUES (?, ?, ?)')
    qstmt.run(recipient, subject, body, function (qerr) {
      if (qerr) return res.status(500).json({ error: 'db_error' })
      res.json({ queued: this.lastID })
    })
    qstmt.finalize()
  })
})

// Admin: list users
app.get('/api/users', requireAdmin, (req, res) => {
  db.all('SELECT id, email, full_name, kyc_status, kyc_data FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    // try to parse kyc_data JSON
    const out = rows.map(r => ({ ...r, kyc_data: r.kyc_data ? JSON.parse(r.kyc_data) : null }))
    res.json(out);
  });
});

app.get('/api/users/:id/audit', requireAdmin, (req, res) => {
  const id = req.params.id
  db.all('SELECT id, action, actor, reason, data, created_at FROM kyc_audit WHERE user_id = ? ORDER BY created_at DESC', id, (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json(rows)
  })
})

// Admin: set KYC status (approve/reject)
app.post('/api/users/:id/kyc/:action', requireAdmin, (req, res) => {
  const id = req.params.id
  const action = req.params.action
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'invalid_action' })
  const status = action === 'approve' ? 'verified' : 'rejected'
  const reason = req.body && req.body.reason ? req.body.reason : null
  db.run('UPDATE users SET kyc_status = ? WHERE id = ?', status, id, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    // insert audit entry
    const aid = db.prepare('INSERT INTO kyc_audit (user_id, action, actor, reason, data) VALUES (?, ?, ?, ?, ?)')
    aid.run(id, action, 'admin', reason, null, function (aerr) {
      aid.finalize()
      // notify user email
      db.get('SELECT email FROM users WHERE id = ?', id, (err2, row) => {
        if (row && row.email) {
          const subj = action === 'approve' ? 'KYC verified' : 'KYC rejected'
          const body = action === 'approve' ? 'Your KYC has been approved.' : `Your KYC was rejected. Reason: ${reason || 'no reason provided'}`
          sendEmailIfConfigured(row.email, subj, body)
        }
        res.json({ updated: this.changes, kyc_status: status })
      })
    })
  })
})

// Lookup user by email (public)
app.get('/api/users/by-email', (req, res) => {
  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'missing_email' })
  db.get('SELECT id, email, full_name, kyc_status FROM users WHERE email = ?', email, (err, row) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    if (!row) return res.status(404).json({ error: 'not_found' })
    res.json(row)
  })
})

// Withdrawals by email convenience endpoint
app.post('/api/withdrawals-by-email', (req, res) => {
  const { email, amount, address } = req.body
  if (!email || !amount || !address) return res.status(400).json({ error: 'invalid_payload' })
  db.get('SELECT id FROM users WHERE email = ?', email, (err, row) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    if (!row) return res.status(404).json({ error: 'user_not_found' })
    const stmt = db.prepare('INSERT INTO withdrawals (user_id, amount, address, status) VALUES (?, ?, ?, ?)')
    stmt.run(row.id, amount, address, 'pending', function (err) {
      if (err) return res.status(500).json({ error: 'db_error' })
      res.status(201).json({ id: this.lastID })
    })
    stmt.finalize()
  })
})

// Withdrawals: submit
app.post('/api/withdrawals', (req, res) => {
  const { user_id, amount, address } = req.body
  if (!user_id || !amount || !address) return res.status(400).json({ error: 'invalid_payload' })
  const stmt = db.prepare('INSERT INTO withdrawals (user_id, amount, address, status) VALUES (?, ?, ?, ?)')
  stmt.run(user_id, amount, address, 'pending', function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.status(201).json({ id: this.lastID })
  })
  stmt.finalize()
})

// Admin: list withdrawals
app.get('/api/withdrawals', requireAdmin, (req, res) => {
  db.all('SELECT w.id, w.user_id, w.amount, w.address, w.status, w.created_at, u.email FROM withdrawals w LEFT JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json(rows)
  })
})

// Admin: approve/reject withdrawal
app.post('/api/withdrawals/:id/:action', requireAdmin, (req, res) => {
  const id = req.params.id
  const action = req.params.action
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'invalid_action' })
  const status = action === 'approve' ? 'approved' : 'rejected'
  db.run('UPDATE withdrawals SET status = ? WHERE id = ?', status, id, function (err) {
    if (err) return res.status(500).json({ error: 'db_error' })
    res.json({ updated: this.changes })
  })
})

app.listen(PORT, () => {
  console.log(`Pluto Mining app running at http://localhost:${PORT}/`);
});
