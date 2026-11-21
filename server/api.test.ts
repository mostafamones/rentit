import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { createHandler } from './app.ts'
import { openDb } from './db.ts'
import { addDays, isDate, quote, rentalHitsBlock, rentalsOverlap, validateRentalDates } from '../src/domain/rental.ts'

const TODAY = '2026-12-01'
const dir = mkdtempSync(join(tmpdir(), 'rentit-test-'))
const db = openDb(join(dir, 'test.db'))
const server = createServer(createHandler({ db, uploadsDir: join(dir, 'uploads'), today: () => TODAY }))
let base = ''

before(() => new Promise<void>((done) => server.listen(0, () => {
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  done()
})))
after(() => { server.close() })

async function call(method: string, path: string, token?: string, body?: object) {
  const res = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() as any }
}

async function register(email: string, accountType = 'individual') {
  const { status, data } = await call('POST', '/auth/register', undefined, {
    email, password: 'password123', name: email.split('@')[0], phone: '+20 100 123 4567', accountType,
    businessName: accountType === 'business' ? 'Fleet Co' : undefined,
  })
  assert.equal(status, 200, JSON.stringify(data))
  return data.token as string
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex').toString('base64')
const car = { make: 'Hyundai', model: 'Accent', year: 2022, vehicleType: 'sedan', transmission: 'automatic', fuel: 'petrol', seats: 5, district: 'Maadi', dailyRateEgp: 1500, terms: 'ID needed' }

test('domain date and quote conventions', () => {
  assert.deepEqual(quote('2026-12-03', '2026-12-05', 1500), { days: 2, dailyRateEgp: 1500, totalEgp: 3000 })
  assert.equal(isDate('2026-02-30'), false)
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(validateRentalDates('2026-12-05', '2026-12-05', TODAY), 'Return date must be after the pickup date.')
  assert.equal(validateRentalDates('2026-11-30', '2026-12-02', TODAY), 'Pickup date is in the past.')
  // Back-to-back rentals share the handover day.
  assert.equal(rentalsOverlap({ startDate: '2026-12-01', endDate: '2026-12-03' }, { startDate: '2026-12-03', endDate: '2026-12-04' }), false)
  assert.equal(rentalsOverlap({ startDate: '2026-12-01', endDate: '2026-12-04' }, { startDate: '2026-12-03', endDate: '2026-12-05' }), true)
  // A block is inclusive: blocking the 3rd stops a rental picked up on the 3rd but not one returned on the 3rd.
  assert.equal(rentalHitsBlock({ startDate: '2026-12-01', endDate: '2026-12-03' }, { startDate: '2026-12-03', endDate: '2026-12-03' }), false)
  assert.equal(rentalHitsBlock({ startDate: '2026-12-03', endDate: '2026-12-04' }, { startDate: '2026-12-03', endDate: '2026-12-03' }), true)
})

test('cross-account request, accept, overlap, contact and cancel flow', async () => {
  const owner = await register('owner@test.dev', 'business')
  const alice = await register('alice@test.dev')
  const bob = await register('bob@test.dev')

  // Owner posts a car; it starts paused and cannot publish without a photo.
  let r = await call('POST', '/listings', owner, car)
  assert.equal(r.status, 200)
  const id = r.data.listing.id
  assert.equal(r.data.listing.status, 'paused')
  assert.equal((await call('PATCH', `/listings/${id}`, owner, { status: 'active' })).status, 400)
  assert.equal((await call('POST', `/listings/${id}/photos`, owner, { mimeType: 'image/png', base64: Buffer.from('nope').toString('base64') })).status, 400)
  assert.equal((await call('POST', `/listings/${id}/photos`, owner, { mimeType: 'image/png', base64: PNG })).status, 200)
  assert.equal((await call('PATCH', `/listings/${id}`, alice, { status: 'active' })).status, 404, 'non-owner cannot edit')
  assert.equal((await call('PATCH', `/listings/${id}`, owner, { status: 'active' })).data.listing.status, 'active')

  // Guests browse and filter.
  assert.equal((await call('GET', '/listings?district=Maadi&maxPrice=2000')).data.listings.length, 1)
  assert.equal((await call('GET', '/listings?transmission=manual')).data.listings.length, 0)

  // Request validation.
  assert.equal((await call('POST', '/requests', undefined, { listingId: id })).status, 401)
  assert.equal((await call('POST', '/requests', owner, { listingId: id, startDate: '2026-12-03', endDate: '2026-12-05', expectedTotalEgp: 3000 })).status, 400, 'owner cannot rent own car')
  assert.equal((await call('POST', '/requests', alice, { listingId: id, startDate: '2026-12-03', endDate: '2026-12-05', expectedTotalEgp: 999 })).status, 409, 'stale quote rejected')

  // Overlapping pending requests are both allowed: pending does not reserve.
  r = await call('POST', '/requests', alice, { listingId: id, startDate: '2026-12-03', endDate: '2026-12-05', note: 'Airport run', expectedTotalEgp: 3000 })
  assert.equal(r.status, 200)
  const aliceReq = r.data.request
  assert.equal(aliceReq.status, 'pending')
  assert.equal(aliceReq.totalEgp, 3000)
  assert.equal(aliceReq.contact, null, 'no contact before acceptance')
  r = await call('POST', '/requests', bob, { listingId: id, startDate: '2026-12-04', endDate: '2026-12-06', expectedTotalEgp: 3000 })
  const bobReq = r.data.request
  assert.equal(bobReq.status, 'pending')
  // A non-overlapping request from Bob, back to back with Alice.
  const bobLater = (await call('POST', '/requests', bob, { listingId: id, startDate: '2026-12-05', endDate: '2026-12-06', expectedTotalEgp: 1500 })).data.request

  // Privacy: other renters cannot see a request.
  assert.equal((await call('GET', `/requests/${aliceReq.id}`, bob)).status, 404)
  assert.equal((await call('POST', `/requests/${aliceReq.id}/accept`, alice)).status, 403, 'renter cannot accept')

  // Owner sees incoming; rate change keeps stored quote.
  assert.equal((await call('GET', '/requests?role=owner', owner)).data.requests.length, 3)
  await call('PATCH', `/listings/${id}`, owner, { ...car, dailyRateEgp: 2000 })

  r = await call('POST', `/requests/${aliceReq.id}/accept`, owner)
  assert.equal(r.status, 200)
  assert.equal(r.data.request.status, 'accepted')
  assert.equal(r.data.request.totalEgp, 3000, 'accepted at the quoted amount')
  assert.equal(r.data.request.contact.email, 'alice@test.dev', 'owner sees renter contact')
  assert.equal((await call('GET', `/requests/${aliceReq.id}`, alice)).data.request.contact.phone, '+20 100 123 4567')

  // Overlapping pending request was auto-declined; the back-to-back one stays pending.
  const bobView = (await call('GET', `/requests/${bobReq.id}`, bob)).data.request
  assert.equal(bobView.status, 'declined')
  assert.equal(bobView.contact, null)
  assert.equal((await call('GET', `/requests/${bobLater.id}`, bob)).data.request.status, 'pending')
  assert.equal((await call('POST', `/requests/${bobReq.id}/accept`, owner)).status, 409)

  // New overlapping requests are refused; the listing shows booked dates.
  assert.equal((await call('POST', '/requests', bob, { listingId: id, startDate: '2026-12-04', endDate: '2026-12-05', expectedTotalEgp: 2000 })).status, 409)
  assert.deepEqual((await call('GET', `/listings/${id}`)).data.listing.booked, [{ startDate: '2026-12-03', endDate: '2026-12-05' }])

  // Blocks cannot cover accepted rentals, and block requested dates.
  assert.equal((await call('POST', `/listings/${id}/blocks`, owner, { startDate: '2026-12-04', endDate: '2026-12-04' })).status, 409)
  const blocks = (await call('POST', `/listings/${id}/blocks`, owner, { startDate: '2026-12-10', endDate: '2026-12-12' })).data.blocks
  assert.equal((await call('POST', '/requests', bob, { listingId: id, startDate: '2026-12-12', endDate: '2026-12-13', expectedTotalEgp: 2000 })).status, 409)
  await call('DELETE', `/listings/${id}/blocks/${blocks[0].id}`, owner)

  // Cancel rules: owner declines (not cancels) pending; renter cancels accepted, which frees the dates.
  assert.equal((await call('POST', `/requests/${bobLater.id}/cancel`, owner)).status, 409)
  assert.equal((await call('POST', `/requests/${bobLater.id}/decline`, owner, { reason: 'Car in service' })).data.request.statusReason, 'Car in service')
  r = await call('POST', `/requests/${aliceReq.id}/cancel`, alice)
  assert.equal(r.data.request.status, 'cancelled')
  assert.equal(r.data.request.contact, null, 'contact hidden after cancellation')
  assert.equal((await call('POST', `/requests/${aliceReq.id}/cancel`, alice)).status, 409)
  r = await call('POST', '/requests', bob, { listingId: id, startDate: '2026-12-04', endDate: '2026-12-05', expectedTotalEgp: 2000 })
  assert.equal(r.status, 200, 'dates free again at the new rate')
  assert.equal((await call('POST', `/requests/${r.data.request.id}/accept`, owner)).data.request.status, 'accepted')
  assert.equal((await call('POST', `/requests/${r.data.request.id}/cancel`, owner)).data.request.statusReason, 'Cancelled by the owner.')

  // Reports from non-owners; paused listings disappear for guests.
  assert.equal((await call('POST', `/listings/${id}/report`, bob, { reason: 'Photos look wrong' })).status, 200)
  assert.equal((await call('POST', `/listings/${id}/report`, owner, { reason: 'x' })).status, 400)
  await call('PATCH', `/listings/${id}`, owner, { status: 'paused' })
  assert.equal((await call('GET', `/listings/${id}`)).status, 404)
  assert.equal((await call('GET', `/listings/${id}`, owner)).status, 200)
})

test('concurrent accepts of overlapping requests reserve the dates once', async () => {
  const owner = await register('owner2@test.dev')
  const renters = await Promise.all([1, 2, 3].map((n) => register(`r${n}@test.dev`)))
  const id = (await call('POST', '/listings', owner, car)).data.listing.id
  await call('POST', `/listings/${id}/photos`, owner, { mimeType: 'image/png', base64: PNG })
  await call('PATCH', `/listings/${id}`, owner, { status: 'active' })
  const ids = await Promise.all(renters.map(async (t) =>
    (await call('POST', '/requests', t, { listingId: id, startDate: '2026-12-20', endDate: '2026-12-23', expectedTotalEgp: 4500 })).data.request.id))
  const results = await Promise.all(ids.map((rid) => call('POST', `/requests/${rid}/accept`, owner)))
  assert.equal(results.filter((x) => x.status === 200).length, 1)
  const accepted = db.prepare(`SELECT COUNT(*) AS n FROM requests WHERE listing_id = ? AND status = 'accepted'`).get(id) as { n: number }
  assert.equal(accepted.n, 1)
})

test('auth: wrong password, duplicate email, logout', async () => {
  await register('carol@test.dev')
  assert.equal((await call('POST', '/auth/register', undefined, { email: 'CAROL@test.dev', password: 'password123', name: 'c', phone: '+20 100 123 4567', accountType: 'individual' })).status, 409)
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'carol@test.dev', password: 'wrongpass' })).status, 401)
  const { data } = await call('POST', '/auth/login', undefined, { email: 'carol@test.dev', password: 'password123' })
  assert.equal((await call('GET', '/me', data.token)).status, 200)
  await call('POST', '/auth/logout', data.token)
  assert.equal((await call('GET', '/me', data.token)).status, 401)
})
