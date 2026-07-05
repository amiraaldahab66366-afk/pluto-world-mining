const sqlite3 = require('sqlite3');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) throw err;
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    price REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    full_name TEXT,
    kyc_status TEXT DEFAULT 'not_submitted',
    kyc_data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    address TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS kyc_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    actor TEXT,
    reason TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT,
    subject TEXT,
    body TEXT,
    status TEXT DEFAULT 'pending',
    error TEXT,
    attempts INTEGER DEFAULT 0,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const stmt = db.prepare('INSERT INTO listings (name, amount, price) VALUES (?, ?, ?)');
  stmt.run('Sample Ore Batch', 100.0, 250.0);
  stmt.run('Refined Pluto Bars', 10.0, 5000.0);
  stmt.finalize();

  const ustmt = db.prepare('INSERT OR IGNORE INTO users (email, full_name, kyc_status) VALUES (?, ?, ?)');
  ustmt.run('alice@example.com', 'Alice Miner', 'verified');
  ustmt.finalize();
});

db.close();
console.log('Initialized database at', DB_FILE);
