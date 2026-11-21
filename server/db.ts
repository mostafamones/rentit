import { DatabaseSync } from 'node:sqlite'

export type DB = DatabaseSync

export function openDb(file: string): DB {
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'business')),
      business_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      vehicle_type TEXT NOT NULL,
      transmission TEXT NOT NULL,
      fuel TEXT NOT NULL,
      seats INTEGER NOT NULL,
      district TEXT NOT NULL,
      daily_rate_egp INTEGER NOT NULL,
      terms TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'hidden')),
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      file TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      renter_id INTEGER NOT NULL REFERENCES users(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      daily_rate_egp INTEGER NOT NULL,
      total_egp INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
      status_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS requests_listing ON requests(listing_id, status);
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  // Added after v1: older databases get the column in place.
  if (!(db.prepare("SELECT 1 FROM pragma_table_info('listings') WHERE name = 'is_featured'").get())) {
    db.exec('ALTER TABLE listings ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0')
  }
  return db
}

/** BEGIN IMMEDIATE takes SQLite's write lock up front, so a check-then-write cannot interleave with another writer. */
export function transaction<T>(db: DB, work: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
