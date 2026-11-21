import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from './app.ts'
import type { DB } from './db.ts'

// Sample accounts share this password; see README. They exist only so a fresh install has something to browse.
export const SAMPLE_PASSWORD = 'rentit-sample'

const owners = [
  { email: 'nile.fleet@sample.rentit', name: 'Karim Adel', phone: '+20 100 000 0001', type: 'business', business: 'Nile Fleet Rentals' },
  { email: 'mona@sample.rentit', name: 'Mona Sherif', phone: '+20 100 000 0002', type: 'individual', business: null },
  { email: 'omar@sample.rentit', name: 'Omar Fathy', phone: '+20 100 000 0003', type: 'individual', business: null },
] as const

const cars = [
  { owner: 0, make: 'Hyundai', model: 'Elantra', year: 2023, type: 'sedan', gear: 'automatic', fuel: 'petrol', seats: 5, district: 'Heliopolis', rate: 2200, featured: true, photos: ['elantra.jpg', 'elantra-rear.jpg', 'elantra-interior.jpg'], v1Photos: ['elantra.jpg'], terms: 'Driver licence and national ID at pickup. 300 km per day included. Refundable deposit EGP 5,000.' },
  { owner: 0, make: 'Kia', model: 'Sportage', year: 2023, type: 'suv', gear: 'automatic', fuel: 'petrol', seats: 5, district: 'New Cairo', rate: 3800, featured: true, photos: ['sportage.jpg', 'sportage-rear.jpg'], v1Photos: ['sportage.jpg'], terms: 'Minimum age 25. Return with the same fuel level. Deposit EGP 8,000.' },
  { owner: 0, make: 'Toyota', model: 'Hiace', year: 2021, type: 'van', gear: 'manual', fuel: 'diesel', seats: 14, district: 'Nasr City', rate: 4500, photos: ['hiace.jpg'], terms: 'Self-drive or with our driver on request. Not for intercity trips without notice.' },
  { owner: 1, make: 'Toyota', model: 'Corolla', year: 2022, type: 'sedan', gear: 'automatic', fuel: 'hybrid', seats: 5, district: 'Maadi', rate: 2600, featured: true, photos: ['corolla.jpg', 'corolla-rear.jpg'], v1Photos: ['corolla.jpg', 'corolla-rear.jpg'], terms: 'Non-smoking car. Pickup near Degla. Deposit EGP 4,000.' },
  { owner: 1, make: 'Kia', model: 'Picanto', year: 2021, type: 'hatchback', gear: 'automatic', fuel: 'petrol', seats: 4, district: 'Zamalek', rate: 1300, photos: ['picanto.jpg'], terms: 'Great for city driving. 200 km per day included.' },
  { owner: 2, make: 'Nissan', model: 'Sunny', year: 2020, type: 'sedan', gear: 'manual', fuel: 'petrol', seats: 5, district: 'Dokki', rate: 1200, photos: ['sunny.jpg'], terms: 'Licence and ID copy needed. Deposit EGP 3,000.' },
  { owner: 2, make: 'MG', model: 'ZS', year: 2022, type: 'suv', gear: 'automatic', fuel: 'electric', seats: 5, district: 'Sheikh Zayed', rate: 3000, photos: ['mg-zs.jpg'], terms: 'Delivered at 90% charge; return above 30%. Home charger cable included.' },
  { owner: 2, make: 'Mitsubishi', model: 'L200', year: 2021, type: 'pickup', gear: 'manual', fuel: 'diesel', seats: 5, district: '6th of October', rate: 2800, photos: ['l200.jpg'], terms: 'Load up to 900 kg. No off-road use.' },
] as const

/** Seeds sample listings once, on an empty database. */
export function seedIfEmpty(db: DB, uploadsDir: string) {
  if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return false
  const password = hashPassword(SAMPLE_PASSWORD)
  const ids = owners.map((o) => Number(db.prepare(`INSERT INTO users (email, password_hash, name, phone, account_type, business_name)
    VALUES (?, ?, ?, ?, ?, ?)`).run(o.email, password, o.name, o.phone, o.type, o.business).lastInsertRowid))
  for (const c of cars) {
    const id = db.prepare(`INSERT INTO listings (owner_id, make, model, year, vehicle_type, transmission, fuel, seats, district, daily_rate_egp, terms, status, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)`)
      .run(ids[c.owner], c.make, c.model, c.year, c.type, c.gear, c.fuel, c.seats, c.district, c.rate, c.terms).lastInsertRowid
    if ('featured' in c) db.prepare('UPDATE listings SET is_featured = 1 WHERE id = ?').run(id)
    for (const photo of c.photos) addPhoto(db, uploadsDir, Number(id), photo)
  }
  return true
}

function addPhoto(db: DB, uploadsDir: string, listingId: number, photo: string) {
  const file = `sample-${photo}`
  copyFileSync(join(import.meta.dirname, 'seed-photos', photo), join(uploadsDir, file))
  db.prepare('INSERT INTO photos (listing_id, file) VALUES (?, ?)').run(listingId, file)
}

/**
 * Brings databases seeded by v1 up to date: drops "(sample)" from the demo accounts' display names, features the
 * chosen sample cars and adds their extra photos. Only touches sample listings whose photos are still exactly the
 * v1 set, so owner edits and deleted photos are left alone. Safe to run on every start.
 */
export function upgradeSeed(db: DB, uploadsDir: string) {
  db.exec(`UPDATE users SET name = replace(name, ' (sample)', ''), business_name = replace(business_name, ' (sample)', '')
    WHERE email LIKE '%@sample.rentit' AND (name LIKE '% (sample)' OR business_name LIKE '% (sample)')`)
  for (const c of cars) {
    if (!('featured' in c)) continue
    const listing = db.prepare(`SELECT l.id FROM listings l JOIN users u ON u.id = l.owner_id
      WHERE l.is_sample = 1 AND u.email = ? AND l.make = ? AND l.model = ?`).get(owners[c.owner].email, c.make, c.model) as { id: number } | undefined
    if (!listing) continue
    const files = (db.prepare('SELECT file FROM photos WHERE listing_id = ? ORDER BY id').all(listing.id) as { file: string }[]).map((p) => p.file)
    if (files.join() !== c.v1Photos.map((p) => `sample-${p}`).join()) continue
    db.prepare('UPDATE listings SET is_featured = 1 WHERE id = ?').run(listing.id)
    for (const photo of c.photos.slice(c.v1Photos.length)) addPhoto(db, uploadsDir, listing.id, photo)
  }
}
