import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import sharp, { type Sharp } from 'sharp'
import { HERO_HEIGHT, HERO_WIDTH, heroImage } from './hero.ts'

const SPORTAGE = readFileSync(join(import.meta.dirname, 'seed-photos', 'sportage.jpg'))

async function pixels(img: Sharp) {
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

const rowDiff = (d: Buffer, width: number, a: number, b: number) => {
  let sum = 0
  for (let x = 0; x < width * 3; x++) sum += Math.abs(d[a * width * 3 + x] - d[b * width * 3 + x])
  return sum / (width * 3)
}

/** The hero's photo rect must be the original, only resized (JPEG noise aside), never cropped or warped. */
async function assertPhotoIntact(input: Buffer) {
  const { jpeg, photo } = await heroImage(input)
  const out = await pixels(sharp(jpeg))
  assert.equal(out.width, HERO_WIDTH)
  assert.equal(out.height, HERO_HEIGHT)
  const got = await pixels(sharp(jpeg).extract(photo))
  const want = await pixels(sharp(input).rotate().resize(photo.width, photo.height, { fit: 'fill' }))
  let diff = 0
  for (let i = 0; i < want.data.length; i++) diff += Math.abs(got.data[i] - want.data[i])
  // JPEG noise alone is ~3.7 on this foliage; a one-row shift or any crop/stretch is ~14.
  assert.ok(diff / want.data.length < 6, `photo region drifted by ${diff / want.data.length}`)
  return { out, photo }
}

test('landscape: whole photo full width at the bottom, top edge continues without a step', async () => {
  const { out, photo } = await assertPhotoIntact(SPORTAGE)
  const m = await sharp(SPORTAGE).metadata()
  assert.equal(photo.width, HERO_WIDTH)
  assert.equal(photo.top + photo.height, HERO_HEIGHT)
  assert.ok(Math.abs(photo.height - Math.round((HERO_WIDTH * m.height) / m.width)) <= 1, 'natural aspect kept')
  // The seam row pair differs no more than neighbouring rows inside the real photo do.
  const inside = rowDiff(out.data, out.width, photo.top + 1, photo.top + 2)
  const seam = rowDiff(out.data, out.width, photo.top - 1, photo.top)
  assert.ok(seam <= inside * 1.5, `seam ${seam} vs photo ${inside}`)
})

test('portrait from EXIF: upright, full height, sides continued instead of cropping', async () => {
  const rotated = await sharp(SPORTAGE).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const { photo } = await assertPhotoIntact(rotated)
  assert.equal(photo.top, 0)
  assert.equal(photo.height, HERO_HEIGHT)
  assert.ok(photo.width < photo.height && photo.left > 0)
})

test('undecodable input rejects', async () => {
  await assert.rejects(heroImage(Buffer.from('not an image')))
})
