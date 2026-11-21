import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pageAt } from './media.ts'

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
