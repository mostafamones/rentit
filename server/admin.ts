// Manual review for the pilot. Run with the API's DATA_DIR, e.g. `npm run admin -- reports`.
import { join, resolve } from 'node:path'
import { openDb } from './db.ts'

const db = openDb(join(resolve(process.env.DATA_DIR ?? join(import.meta.dirname, '..', 'data')), 'rentit.db'))
const [command, arg] = process.argv.slice(2)
const id = Number(arg)

switch (command) {
  case 'reports':
    console.table(db.prepare(`SELECT r.id, r.listing_id AS listing, l.make || ' ' || l.model AS car, l.status AS listingStatus,
      u.email AS reporter, r.reason, r.created_at AS at FROM reports r JOIN listings l ON l.id = r.listing_id
      JOIN users u ON u.id = r.reporter_id WHERE r.status = 'open' ORDER BY r.id`).all())
    break
  case 'listings':
    console.table(db.prepare(`SELECT l.id, l.make || ' ' || l.model AS car, l.district, l.daily_rate_egp AS rate, l.status,
      u.email AS owner, l.created_at AS at FROM listings l JOIN users u ON u.id = l.owner_id ORDER BY l.id DESC LIMIT 50`).all())
    break
  case 'hide':
  case 'restore':
    if (!id) throw new Error(`Usage: ${command} <listingId>`)
    // Restoring returns the listing as paused so the owner decides when to republish.
    db.prepare(`UPDATE listings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(command === 'hide' ? 'hidden' : 'paused', id)
    console.log(`Listing ${id} ${command === 'hide' ? 'hidden' : 'restored as paused'}.`)
    break
  case 'resolve':
    if (!id) throw new Error('Usage: resolve <reportId>')
    db.prepare(`UPDATE reports SET status = 'resolved' WHERE id = ?`).run(id)
    console.log(`Report ${id} resolved.`)
    break
  default:
    console.log('Commands: reports | listings | hide <listingId> | restore <listingId> | resolve <reportId>')
}
