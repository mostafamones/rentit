import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitRect, heroHeight, pageAt } from './media.ts'

test('rounds to the nearest page', () => {
  assert.equal(pageAt(0, 390, 3), 0)
  assert.equal(pageAt(400, 390, 3), 1)
  assert.equal(pageAt(780, 390, 3), 2)
})

test('stays in range when the pager bounces or the list shrinks', () => {
  assert.equal(pageAt(-60, 390, 3), 0)
  assert.equal(pageAt(1300, 390, 3), 2)
  assert.equal(pageAt(780, 390, 1), 0)
})

test('is page 0 before layout or without photos', () => {
  assert.equal(pageAt(500, 0, 3), 0)
  assert.equal(pageAt(500, 390, 0), 0)
})

// 390×844 phone: min 242, max 488.
const W = 390, H = 844

test('hero takes a photo’s natural height between the bounds', () => {
  assert.equal(heroHeight(W, H, 1280 / 960), 293) // 4:3
  assert.equal(heroHeight(W, H, 3 / 2), 260)
})

test('a short photo gets the minimum, with a centered uncropped fill', () => {
  assert.equal(heroHeight(W, H, 1280 / 636), 242)
  const r = fitRect(W, 242, 1280 / 636)
  assert.deepEqual([r.left, r.width, r.fill], [0, 390, true])
  assert.ok(Math.abs(r.top - (242 - r.height) / 2) < 1e-9 && r.height < 200)
})

test('a photo just short of the minimum sets the height itself', () => {
  const h = heroHeight(W, H, 1280 / 750)
  assert.ok(h === Math.round(390 * 750 / 1280) && h < 242)
  assert.equal(fitRect(W, h, 1280 / 750).fill, false)
})

test('a portrait photo is capped and fitted inside with plain side space', () => {
  assert.equal(heroHeight(W, H, 3 / 4), 488)
  const r = fitRect(W, 488, 3 / 4)
  assert.deepEqual([r.top, r.height, r.width, r.fill], [0, 488, 366, false])
  assert.equal(r.left, 12)
})

test('unknown or broken dimensions use the minimum', () => {
  assert.equal(heroHeight(W, H), 242)
  assert.equal(heroHeight(W, H, 0), 242)
  assert.equal(heroHeight(W, H, NaN), 242)
})

test('a short landscape screen keeps min under max', () => {
  assert.equal(heroHeight(844, 390), 234)
  assert.equal(heroHeight(844, 390, 16 / 9), 234)
})

test('the height follows the photo on the resting page, not the first', () => {
  const aspects = [3 / 4, 1280 / 636, 4 / 3]
  assert.deepEqual([0, 390, 780].map((x) => heroHeight(W, H, aspects[pageAt(x, W, 3)])), [488, 242, 293])
})

test('fit snaps sub-point gaps to the frame edge', () => {
  assert.deepEqual(fitRect(W, 260.4, 3 / 2), { left: 0, top: 0, width: 390, height: 260.4, fill: false })
})
