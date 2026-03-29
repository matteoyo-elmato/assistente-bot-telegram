const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

// ── Schema ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id    INTEGER PRIMARY KEY,
    username   TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    plan       TEXT DEFAULT 'free',
    plan_start INTEGER,
    plan_end   INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS daily_usage (
    user_id    INTEGER NOT NULL,
    date       TEXT NOT NULL,
    count      INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    chat_id    INTEGER NOT NULL,
    text       TEXT NOT NULL,
    remind_at  INTEGER NOT NULL,
    sent       INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    amount      REAL NOT NULL,
    category    TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS lists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    list_name  TEXT NOT NULL,
    item       TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
`);

// ── UTENTI ────────────────────────────────────────────────────────────────
function upsertUser(userId, username, firstName) {
  db.prepare(`
    INSERT INTO users (user_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name
  `).run(userId, username, firstName);
}

function getUser(userId) {
  return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
}

// Usato manualmente dall'admin per aggiornare il piano di un utente
function setUserPlan(userId, plan) {
  const now = Date.now();
  const end = now + 30 * 24 * 60 * 60 * 1000; // 30 giorni
  db.prepare('UPDATE users SET plan = ?, plan_start = ?, plan_end = ? WHERE user_id = ?')
    .run(plan, now, end, userId);
}

// ── UTILIZZO GIORNALIERO ──────────────────────────────────────────────────
function getDailyMessageCount(userId, date) {
  const row = db.prepare('SELECT count FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, date);
  return row?.count || 0;
}

function incrementDailyCount(userId, date) {
  db.prepare(`
    INSERT INTO daily_usage (user_id, date, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  `).run(userId, date);
}

// ── PROMEMORIA ────────────────────────────────────────────────────────────
function addReminder(userId, chatId, text, remindAt) {
  return db.prepare('INSERT INTO reminders (user_id, chat_id, text, remind_at) VALUES (?, ?, ?, ?)')
    .run(userId, chatId, text, remindAt);
}

function getReminders(userId) {
  return db.prepare('SELECT * FROM reminders WHERE user_id = ? AND sent = 0 AND remind_at > ? ORDER BY remind_at ASC')
    .all(userId, Date.now());
}

function getPendingReminders() {
  return db.prepare('SELECT * FROM reminders WHERE sent = 0 AND remind_at <= ?')
    .all(Date.now());
}

function markReminderSent(id) {
  db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);
}

// ── SPESE ─────────────────────────────────────────────────────────────────
function addExpense(userId, amount, category, description) {
  return db.prepare('INSERT INTO expenses (user_id, amount, category, description) VALUES (?, ?, ?, ?)')
    .run(userId, amount, category, description);
}

function getExpenses(userId, month, year) {
  const start = new Date(year, month - 1, 1).getTime();
  const end   = new Date(year, month, 1).getTime();
  return db.prepare('SELECT * FROM expenses WHERE user_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC')
    .all(userId, start, end);
}

// ── LISTE ─────────────────────────────────────────────────────────────────
function addToList(userId, listName, items) {
  const stmt = db.prepare('INSERT INTO lists (user_id, list_name, item) VALUES (?, ?, ?)');
  items.forEach(item => stmt.run(userId, listName, item));
}

function getList(userId, listName) {
  return db.prepare('SELECT * FROM lists WHERE user_id = ? AND list_name = ? ORDER BY created_at ASC')
    .all(userId, listName);
}

function removeFromList(userId, listName, items) {
  const stmt = db.prepare('DELETE FROM lists WHERE user_id = ? AND list_name = ? AND LOWER(item) = LOWER(?)');
  items.forEach(item => stmt.run(userId, listName, item));
}

// ── NOTE ──────────────────────────────────────────────────────────────────
function addNote(userId, text) {
  return db.prepare('INSERT INTO notes (user_id, text) VALUES (?, ?)').run(userId, text);
}

function getNotes(userId) {
  return db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId);
}

module.exports = {
  upsertUser, getUser, setUserPlan,
  getDailyMessageCount, incrementDailyCount,
  addReminder, getReminders, getPendingReminders, markReminderSent,
  addExpense, getExpenses,
  addToList, getList, removeFromList,
  addNote, getNotes,
};
