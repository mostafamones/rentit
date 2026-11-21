import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import {
  DISTRICTS, FUELS, TRANSMISSIONS, VEHICLE_TYPES, cairoToday, quote, rentalHitsBlock, rentalsOverlap, validateRentalDates, isDate,
  type Range,
} from '../src/domain/rental.ts'
import { transaction, type DB } from './db.ts'
import { heroFile } from './hero.ts'

export type Config = { db: DB; uploadsDir: string; today?: () => string }

class HttpError extends Error {
  status: number
  extra?: object
  constructor(status: number, message: string, extra?: object) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

const MAX_BODY = 12 * 1024 * 1024 // base64 photos
const MAX_PHOTOS = 6
const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(8, 12).toString() === 'WEBP' },
}

type Row = Record<string, any>
type Ctx = { req: IncomingMessage; body: Row; params: string[]; query: URLSearchParams; cfg: Config; user?: Row }
type Handler = (ctx: Ctx) => unknown

// --- passwords and sessions ---

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`
}

function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  const actual = scryptSync(password, Buffer.from(salt, 'hex'), 32)
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

function startSession(db: DB, userId: number) {
  const token = randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)').run(sha256(token), userId)
  return token
}

function authenticate(db: DB, req: IncomingMessage) {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return undefined
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .get(sha256(header.slice(7))) as Row | undefined
}

// --- validation ---

function text(body: Row, key: string, max: number, { optional = false, min = 1 } = {}) {
  const value = typeof body[key] === 'string' ? body[key].trim() : ''
  if (!value && optional) return ''
  if (value.length < min || value.length > max) throw new HttpError(400, `${key} must be ${min}–${max} characters.`)
  return value
}

function int(body: Row, key: string, min: number, max: number) {
  const value = body[key]
  if (!Number.isInteger(value) || value < min || value > max) throw new HttpError(400, `${key} must be a whole number from ${min} to ${max}.`)
  return value as number
}

function oneOf<T extends string>(body: Row, key: string, values: readonly T[]) {
  if (!values.includes(body[key])) throw new HttpError(400, `${key} must be one of: ${values.join(', ')}.`)
  return body[key] as T
}

function requireUser(ctx: Ctx) {
  if (!ctx.user) throw new HttpError(401, 'Sign in to continue.')
  return ctx.user
}

// --- serialisation ---

const publicUser = (u: Row) => ({ id: u.id, name: u.name, accountType: u.account_type, businessName: u.business_name ?? null })
const me = (u: Row) => ({ ...publicUser(u), email: u.email, phone: u.phone })

function listingOut(db: DB, l: Row, viewer?: Row) {
  const photos = db.prepare('SELECT id, file FROM photos WHERE listing_id = ? ORDER BY id').all(l.id) as Row[]
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(l.owner_id) as Row
  return {
    id: l.id, make: l.make, model: l.model, year: l.year, vehicleType: l.vehicle_type, transmission: l.transmission, fuel: l.fuel,
    seats: l.seats, district: l.district, dailyRateEgp: l.daily_rate_egp, terms: l.terms, status: l.status, featured: !!l.is_featured,
    photos: photos.map((p) => ({ id: p.id, url: `/uploads/${p.file}` })),
    owner: publicUser(owner), isMine: viewer?.id === l.owner_id,
  }
}

function acceptedRanges(db: DB, listingId: number, exceptId = 0) {
  return db.prepare(`SELECT id, start_date AS startDate, end_date AS endDate FROM requests
    WHERE listing_id = ? AND status = 'accepted' AND id != ?`).all(listingId, exceptId) as (Range & { id: number })[]
}

function blockRanges(db: DB, listingId: number) {
  return db.prepare('SELECT id, start_date AS startDate, end_date AS endDate FROM blocks WHERE listing_id = ? ORDER BY start_date')
    .all(listingId) as (Range & { id: number })[]
}

function requestOut(db: DB, r: Row, viewer: Row) {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(r.listing_id) as Row
  const photo = db.prepare('SELECT file FROM photos WHERE listing_id = ? ORDER BY id LIMIT 1').get(r.listing_id) as Row | undefined
  const renter = db.prepare('SELECT * FROM users WHERE id = ?').get(r.renter_id) as Row
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(listing.owner_id) as Row
  const role = viewer.id === r.renter_id ? 'renter' : 'owner'
  const other = role === 'renter' ? owner : renter
  return {
    id: r.id, role, status: r.status, statusReason: r.status_reason, startDate: r.start_date, endDate: r.end_date,
    days: r.days, dailyRateEgp: r.daily_rate_egp, totalEgp: r.total_egp, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at,
    listing: {
      id: listing.id, title: `${listing.make} ${listing.model} ${listing.year}`, district: listing.district,
      photoUrl: photo ? `/uploads/${photo.file}` : null,
    },
    renter: publicUser(renter), owner: publicUser(owner),
    // Phone and email are shared only between the two participants, and only once the owner accepts.
    contact: r.status === 'accepted' ? { name: other.business_name || other.name, phone: other.phone, email: other.email } : null,
  }
}

// --- handlers ---

function ownListing(ctx: Ctx) {
  const user = requireUser(ctx)
  const listing = ctx.cfg.db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(ctx.params[0])) as Row | undefined
  if (!listing || listing.owner_id !== user.id) throw new HttpError(404, 'Listing not found.')
  return listing
}

function listingFields(body: Row) {
  return {
    make: text(body, 'make', 40), model: text(body, 'model', 40),
    year: int(body, 'year', 1990, new Date().getFullYear() + 1),
    vehicleType: oneOf(body, 'vehicleType', VEHICLE_TYPES), transmission: oneOf(body, 'transmission', TRANSMISSIONS),
    fuel: oneOf(body, 'fuel', FUELS), seats: int(body, 'seats', 2, 15), district: oneOf(body, 'district', DISTRICTS),
    dailyRateEgp: int(body, 'dailyRateEgp', 200, 100_000), terms: text(body, 'terms', 1000, { optional: true }),
  }
}

function loadRequest(ctx: Ctx) {
  const user = requireUser(ctx)
  const r = ctx.cfg.db.prepare(`SELECT r.*, l.owner_id FROM requests r JOIN listings l ON l.id = r.listing_id WHERE r.id = ?`)
    .get(Number(ctx.params[0])) as Row | undefined
  if (!r || (r.renter_id !== user.id && r.owner_id !== user.id)) throw new HttpError(404, 'Request not found.')
  return { user, r, isOwner: r.owner_id === user.id }
}

function setStatus(db: DB, id: number, status: string, reason: string | null) {
  db.prepare(`UPDATE requests SET status = ?, status_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(status, reason, id)
}

const today = (ctx: Ctx) => ctx.cfg.today?.() ?? cairoToday()

const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/health$/, () => ({ ok: true })],

  ['POST', /^\/auth\/register$/, ({ body, cfg: { db } }) => {
    const email = text(body, 'email', 120).toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email.')
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Password must be at least 8 characters.')
    const name = text(body, 'name', 60)
    const phone = text(body, 'phone', 20, { min: 8 })
    if (!/^\+?[\d\s-]{8,20}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.')
    const accountType = oneOf(body, 'accountType', ['individual', 'business'] as const)
    const businessName = accountType === 'business' ? text(body, 'businessName', 80) : null
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'An account with this email already exists.')
    const { lastInsertRowid } = db.prepare(`INSERT INTO users (email, password_hash, name, phone, account_type, business_name)
      VALUES (?, ?, ?, ?, ?, ?)`).run(email, hashPassword(password), name, phone, accountType, businessName)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid) as Row
    return { token: startSession(db, user.id), user: me(user) }
  }],

  ['POST', /^\/auth\/login$/, ({ body, cfg: { db } }) => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(body.email ?? '').trim().toLowerCase()) as Row | undefined
    if (!user || !checkPassword(String(body.password ?? ''), user.password_hash)) throw new HttpError(401, 'Email or password is incorrect.')
    return { token: startSession(db, user.id), user: me(user) }
  }],

  ['POST', /^\/auth\/logout$/, ({ req, cfg: { db } }) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256((req.headers.authorization ?? '').slice(7)))
    return { ok: true }
  }],

  ['GET', /^\/me$/, (ctx) => ({ user: me(requireUser(ctx)) })],

  ['GET', /^\/listings$/, ({ query, user, cfg: { db } }) => {
    const where = [`status = 'active'`]
    const args: (string | number)[] = []
    const district = query.get('district')
    if (district) { where.push('district = ?'); args.push(district) }
    const type = query.get('vehicleType')
    if (type) { where.push('vehicle_type = ?'); args.push(type) }
    const transmission = query.get('transmission')
    if (transmission) { where.push('transmission = ?'); args.push(transmission) }
    // Every word must match make, model or district, so "kia new cairo" narrows rather than widens.
    for (const word of (query.get('q') ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      where.push(`lower(make || ' ' || model || ' ' || district) LIKE ? ESCAPE '\\'`)
      args.push(`%${word.replace(/[\\%_]/g, '\\$&')}%`)
    }
    const maxPrice = Number(query.get('maxPrice'))
    if (maxPrice > 0) { where.push('daily_rate_egp <= ?'); args.push(maxPrice) }
    const rows = db.prepare(`SELECT * FROM listings WHERE ${where.join(' AND ')} ORDER BY is_featured DESC, is_sample, created_at DESC, id DESC LIMIT 200`)
      .all(...args) as Row[]
    return { listings: rows.map((l) => listingOut(db, l, user)) }
  }],

  ['GET', /^\/listings\/mine$/, (ctx) => {
    const user = requireUser(ctx)
    const rows = ctx.cfg.db.prepare('SELECT * FROM listings WHERE owner_id = ? ORDER BY id DESC').all(user.id) as Row[]
    return { listings: rows.map((l) => listingOut(ctx.cfg.db, l, user)) }
  }],

  ['GET', /^\/listings\/(\d+)$/, ({ params, user, cfg: { db } }) => {
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(params[0])) as Row | undefined
    if (!l || (l.status !== 'active' && l.owner_id !== user?.id)) throw new HttpError(404, 'This car is not available.')
    return {
      listing: {
        ...listingOut(db, l, user),
        booked: acceptedRanges(db, l.id).map(({ startDate, endDate }) => ({ startDate, endDate })),
        blocks: blockRanges(db, l.id),
      },
    }
  }],

  ['POST', /^\/listings$/, (ctx) => {
    const user = requireUser(ctx)
    const f = listingFields(ctx.body)
    const { lastInsertRowid } = ctx.cfg.db.prepare(`INSERT INTO listings
      (owner_id, make, model, year, vehicle_type, transmission, fuel, seats, district, daily_rate_egp, terms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paused')`)
      .run(user.id, f.make, f.model, f.year, f.vehicleType, f.transmission, f.fuel, f.seats, f.district, f.dailyRateEgp, f.terms)
    // New listings start paused so the owner can add photos before publishing.
    const l = ctx.cfg.db.prepare('SELECT * FROM listings WHERE id = ?').get(lastInsertRowid) as Row
    return { listing: listingOut(ctx.cfg.db, l, user) }
  }],

  ['PATCH', /^\/listings\/(\d+)$/, (ctx) => {
    const l = ownListing(ctx)
    const db = ctx.cfg.db
    if ('status' in ctx.body && Object.keys(ctx.body).length === 1) {
      const status = oneOf(ctx.body, 'status', ['active', 'paused'] as const)
      if (l.status === 'hidden') throw new HttpError(403, 'This listing is under review. Contact support to restore it.')
      if (status === 'active' && !db.prepare('SELECT 1 FROM photos WHERE listing_id = ?').get(l.id)) {
        throw new HttpError(400, 'Add at least one photo before publishing.')
      }
      db.prepare(`UPDATE listings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, l.id)
    } else {
      const f = listingFields(ctx.body)
      // A rate change applies to new requests only; existing requests keep their stored quote.
      db.prepare(`UPDATE listings SET make = ?, model = ?, year = ?, vehicle_type = ?, transmission = ?, fuel = ?, seats = ?,
        district = ?, daily_rate_egp = ?, terms = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(f.make, f.model, f.year, f.vehicleType, f.transmission, f.fuel, f.seats, f.district, f.dailyRateEgp, f.terms, l.id)
    }
    return { listing: listingOut(db, db.prepare('SELECT * FROM listings WHERE id = ?').get(l.id) as Row, ctx.user) }
  }],

  ['POST', /^\/listings\/(\d+)\/photos$/, (ctx) => {
    const l = ownListing(ctx)
    const type = IMAGE_TYPES[ctx.body.mimeType]
    if (!type || typeof ctx.body.base64 !== 'string') throw new HttpError(400, 'Upload a JPEG, PNG or WebP photo.')
    const data = Buffer.from(ctx.body.base64, 'base64')
    if (data.length < 12 || !type.magic(data)) throw new HttpError(400, 'That file is not a valid image.')
    const count = (ctx.cfg.db.prepare('SELECT COUNT(*) AS n FROM photos WHERE listing_id = ?').get(l.id) as Row).n
    if (count >= MAX_PHOTOS) throw new HttpError(400, `A listing can have up to ${MAX_PHOTOS} photos.`)
    const file = `${l.id}-${randomBytes(8).toString('hex')}.${type.ext}`
    writeFileSync(join(ctx.cfg.uploadsDir, file), data)
    ctx.cfg.db.prepare('INSERT INTO photos (listing_id, file) VALUES (?, ?)').run(l.id, file)
    return { listing: listingOut(ctx.cfg.db, l, ctx.user) }
  }],

  ['DELETE', /^\/listings\/(\d+)\/photos\/(\d+)$/, (ctx) => {
    const l = ownListing(ctx)
    const db = ctx.cfg.db
    db.prepare('DELETE FROM photos WHERE id = ? AND listing_id = ?').run(Number(ctx.params[1]), l.id)
    if (l.status === 'active' && !db.prepare('SELECT 1 FROM photos WHERE listing_id = ?').get(l.id)) {
      db.prepare(`UPDATE listings SET status = 'paused' WHERE id = ?`).run(l.id)
    }
    // The file stays on disk; uploads are small and this keeps deletes simple.
    return { listing: listingOut(db, db.prepare('SELECT * FROM listings WHERE id = ?').get(l.id) as Row, ctx.user) }
  }],

  ['POST', /^\/listings\/(\d+)\/blocks$/, (ctx) => {
    const l = ownListing(ctx)
    const { startDate, endDate } = ctx.body
    if (!isDate(startDate) || !isDate(endDate) || endDate < startDate) throw new HttpError(400, 'Choose a valid date range to block.')
    const db = ctx.cfg.db
    return transaction(db, () => {
      if (acceptedRanges(db, l.id).some((r) => rentalHitsBlock(r, { startDate, endDate }))) {
        throw new HttpError(409, 'Those dates include an accepted rental. Cancel it first if you need the car back.')
      }
      db.prepare('INSERT INTO blocks (listing_id, start_date, end_date) VALUES (?, ?, ?)').run(l.id, startDate, endDate)
      return { blocks: blockRanges(db, l.id) }
    })
  }],

  ['DELETE', /^\/listings\/(\d+)\/blocks\/(\d+)$/, (ctx) => {
    const l = ownListing(ctx)
    ctx.cfg.db.prepare('DELETE FROM blocks WHERE id = ? AND listing_id = ?').run(Number(ctx.params[1]), l.id)
    return { blocks: blockRanges(ctx.cfg.db, l.id) }
  }],

  ['POST', /^\/listings\/(\d+)\/report$/, (ctx) => {
    const user = requireUser(ctx)
    const db = ctx.cfg.db
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(ctx.params[0])) as Row | undefined
    if (!l) throw new HttpError(404, 'Listing not found.')
    if (l.owner_id === user.id) throw new HttpError(400, 'You cannot report your own listing.')
    const reason = text(ctx.body, 'reason', 500)
    if (!db.prepare(`SELECT 1 FROM reports WHERE listing_id = ? AND reporter_id = ? AND status = 'open'`).get(l.id, user.id)) {
      db.prepare('INSERT INTO reports (listing_id, reporter_id, reason) VALUES (?, ?, ?)').run(l.id, user.id, reason)
    }
    return { ok: true }
  }],

  ['GET', /^\/requests$/, (ctx) => {
    const user = requireUser(ctx)
    const role = ctx.query.get('role') === 'owner' ? 'owner' : 'renter'
    const rows = ctx.cfg.db.prepare(role === 'owner'
      ? `SELECT r.* FROM requests r JOIN listings l ON l.id = r.listing_id WHERE l.owner_id = ? ORDER BY r.updated_at DESC, r.id DESC`
      : `SELECT * FROM requests WHERE renter_id = ? ORDER BY updated_at DESC, id DESC`).all(user.id) as Row[]
    return { requests: rows.map((r) => requestOut(ctx.cfg.db, r, user)) }
  }],

  ['GET', /^\/requests\/(\d+)$/, (ctx) => {
    const { user, r } = loadRequest(ctx)
    return { request: requestOut(ctx.cfg.db, r, user) }
  }],

  ['POST', /^\/requests$/, (ctx) => {
    const user = requireUser(ctx)
    const db = ctx.cfg.db
    const { body } = ctx
    const l = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(body.listingId)) as Row | undefined
    if (!l || l.status !== 'active') throw new HttpError(404, 'This car is not available.')
    if (l.owner_id === user.id) throw new HttpError(400, 'You cannot rent your own car.')
    const invalid = validateRentalDates(body.startDate, body.endDate, today(ctx))
    if (invalid) throw new HttpError(400, invalid)
    const range = { startDate: body.startDate as string, endDate: body.endDate as string }
    const note = text(body, 'note', 500, { optional: true })
    const q = quote(range.startDate, range.endDate, l.daily_rate_egp)
    // The renter confirms the total they saw; if the owner changed the rate meanwhile, show the new quote instead.
    if (body.expectedTotalEgp !== q.totalEgp) throw new HttpError(409, 'The daily rate changed. Review the new total.', { quote: q })
    return transaction(db, () => {
      // Pending requests do not reserve dates, so only accepted rentals and blocks are checked here.
      if (acceptedRanges(db, l.id).some((r) => rentalsOverlap(r, range)) || blockRanges(db, l.id).some((b) => rentalHitsBlock(range, b))) {
        throw new HttpError(409, 'Those dates are no longer available.')
      }
      const { lastInsertRowid } = db.prepare(`INSERT INTO requests
        (listing_id, renter_id, start_date, end_date, days, daily_rate_egp, total_egp, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(l.id, user.id, range.startDate, range.endDate, q.days, q.dailyRateEgp, q.totalEgp, note)
      return { request: requestOut(db, db.prepare('SELECT * FROM requests WHERE id = ?').get(lastInsertRowid) as Row, user) }
    })
  }],

  ['POST', /^\/requests\/(\d+)\/(accept|decline|cancel)$/, (ctx) => {
    const db = ctx.cfg.db
    const action = ctx.params[1]
    return transaction(db, () => {
      // Re-read inside the write lock so two accepts cannot both pass the overlap check.
      const { user, r, isOwner } = loadRequest(ctx)
      if (action === 'accept' || action === 'decline') {
        if (!isOwner) throw new HttpError(403, 'Only the car owner can do that.')
        if (r.status !== 'pending') throw new HttpError(409, `This request is already ${r.status}.`)
      }
      if (action === 'accept') {
        const range = { startDate: r.start_date, endDate: r.end_date }
        if (acceptedRanges(db, r.listing_id, r.id).some((a) => rentalsOverlap(a, range))) {
          throw new HttpError(409, 'These dates overlap a rental you already accepted.')
        }
        if (blockRanges(db, r.listing_id).some((b) => rentalHitsBlock(range, b))) {
          throw new HttpError(409, 'These dates overlap days you blocked. Remove the block to accept.')
        }
        setStatus(db, r.id, 'accepted', null)
        const pending = db.prepare(`SELECT id, start_date AS startDate, end_date AS endDate FROM requests
          WHERE listing_id = ? AND status = 'pending' AND id != ?`).all(r.listing_id, r.id) as (Range & { id: number })[]
        for (const p of pending) if (rentalsOverlap(p, range)) setStatus(db, p.id, 'declined', 'Those dates were booked by another renter.')
      } else if (action === 'decline') {
        setStatus(db, r.id, 'declined', typeof ctx.body.reason === 'string' && ctx.body.reason.trim() ? ctx.body.reason.trim().slice(0, 300) : null)
      } else {
        const allowed = isOwner ? r.status === 'accepted' : r.status === 'pending' || r.status === 'accepted'
        if (!allowed) throw new HttpError(409, isOwner && r.status === 'pending' ? 'Decline a pending request instead.' : `This request is already ${r.status}.`)
        if (r.end_date <= today(ctx)) throw new HttpError(409, 'This rental has already ended.')
        setStatus(db, r.id, 'cancelled', isOwner ? 'Cancelled by the owner.' : 'Cancelled by the renter.')
      }
      return { request: requestOut(db, db.prepare('SELECT * FROM requests WHERE id = ?').get(r.id) as Row, user) }
    })
  }],
]

function readBody(req: IncomingMessage): Promise<Row> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) { reject(new HttpError(413, 'Upload is too large.')); req.destroy() } else chunks.push(chunk)
    })
    req.on('end', () => {
      if (!size) return resolve({})
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString())
        resolve(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
      } catch { reject(new HttpError(400, 'Invalid JSON body.')) }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, payload: object) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

export function createHandler(cfg: Config) {
  mkdirSync(cfg.uploadsDir, { recursive: true })
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://local')
    try {
      const upload = /^\/uploads\/([\w-]+\.(jpg|png|webp))$/.exec(url.pathname)
      if (req.method === 'GET' && upload) {
        const file = join(cfg.uploadsDir, upload[1])
        if (!existsSync(file)) throw new HttpError(404, 'Not found.')
        res.writeHead(200, { 'content-type': upload[2] === 'jpg' ? 'image/jpeg' : `image/${upload[2]}`, 'cache-control': 'public, max-age=86400' })
        return res.end(readFileSync(file))
      }
      const hero = /^\/uploads\/hero\/([\w-]+\.(?:jpg|png|webp))$/.exec(url.pathname)
      if (req.method === 'GET' && hero) {
        const jpeg = await (heroFile(cfg.uploadsDir, hero[1]) ?? Promise.reject(new HttpError(404, 'Not found.')))
          .catch((e) => {
            if (e instanceof HttpError) throw e
            console.error(e)
            throw new HttpError(422, 'That photo could not be processed.')
          })
        res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' })
        return res.end(jpeg)
      }
      let matchedPath = false
      for (const [method, pattern, handler] of routes) {
        const match = pattern.exec(url.pathname)
        if (!match) continue
        matchedPath = true
        if (method !== req.method) continue
        const body = method === 'GET' ? {} : await readBody(req)
        const user = authenticate(cfg.db, req)
        return send(res, 200, (await handler({ req, body, params: match.slice(1), query: url.searchParams, cfg, user })) as object)
      }
      throw new HttpError(matchedPath ? 405 : 404, 'Not found.')
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message, ...error.extra })
      console.error(error)
      send(res, 500, { error: 'Something went wrong on the server.' })
    }
  }
}
