import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp, { type Sharp } from 'sharp'

/** The listing detail hero is 1:1.05; this is its one server-made variant. */
export const HERO_WIDTH = 1080
export const HERO_HEIGHT = 1134
const MAX_INPUT_PIXELS = 40_000_000

type Raw = { data: Buffer; width: number; height: number }

async function toRaw(img: Sharp): Promise<Raw> {
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

const fromRaw = (r: Raw) => sharp(r.data, { raw: { width: r.width, height: r.height, channels: 3 } })

/**
 * `extra` rows that continue the photo past its top edge: a true reflection of the top rows at the seam that fades into
 * the band's average colors (so the far area never mirrors the subject or repeats a pole) and blurs more with distance,
 * like out-of-focus background.
 */
async function extendTop(photo: Raw, extra: number): Promise<Raw> {
  const { width, height, data } = photo
  const row = width * 3
  const band = Math.max(1, Math.min(height, Math.round(height * 0.08)))
  const mean = new Float64Array(row)
  for (let y = 0; y < band; y++) for (let x = 0; x < row; x++) mean[x] += data[y * row + x] / band
  // Twice a sideways box average: the far colors keep the broad layout of the edge but no fine columns to streak.
  const r = Math.max(1, Math.round(width * 0.025))
  for (let pass = 0; pass < 2; pass++) {
    const src = mean.slice()
    for (let x = 0; x < width; x++) {
      const a = Math.max(0, x - r), b = Math.min(width - 1, x + r)
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let i = a; i <= b; i++) sum += src[i * 3 + c]
        mean[x * 3 + c] = sum / (b - a + 1)
      }
    }
  }
  // The blur also sees the photo's first rows, so the seam blurs into the real image instead of a hard edge.
  const pad = Math.min(height, 64)
  const strip = Buffer.alloc((extra + pad) * row)
  for (let d = 0; d < extra; d++) {
    const src = Math.min(d, band - 1) * row
    const u = Math.min(1, d / (1.5 * band))
    const w = u * u * (3 - 2 * u)
    const o = (extra - 1 - d) * row
    for (let x = 0; x < row; x++) strip[o + x] = Math.round(data[src + x] * (1 - w) + mean[x] * w)
  }
  data.copy(strip, extra * row, 0, pad * row)
  const scale = width / HERO_WIDTH
  const sigmas = [0, 2, 6, 16, 36, 72].map((s) => s * scale)
  const h = extra + pad
  // Far rows repeat one source row, so each level also smooths sideways more than down; that hides vertical streaks.
  const levels = await Promise.all(sigmas.map(async (s) => {
    if (s < 0.3) return strip
    const narrow = await fromRaw({ data: strip, width, height: h }).resize(Math.max(1, Math.round(width / (1 + s))), h, { fit: 'fill' })
      .raw().toBuffer({ resolveWithObject: true })
    return sharp(narrow.data, { raw: { width: narrow.info.width, height: h, channels: 3 } }).resize(width, h, { fit: 'fill' }).blur(s).raw().toBuffer()
  }))
  const out = Buffer.alloc(extra * row)
  const top = sigmas[sigmas.length - 1]
  for (let y = 0; y < extra; y++) {
    // Blur grows with distance; the small base blur hides the mirror's symmetry right at the seam (tuned by eye).
    const d = extra - y
    const want = Math.min(top, scale * (1.5 + 0.12 * d + 60 * (d / extra) ** 2))
    let i = 0
    while (i < sigmas.length - 2 && sigmas[i + 1] < want) i++
    const t = Math.min(1, (want - sigmas[i]) / (sigmas[i + 1] - sigmas[i]))
    const a = levels[i], b = levels[i + 1], o = y * row
    for (let x = 0; x < row; x++) out[o + x] = Math.round(a[o + x] + (b[o + x] - a[o + x]) * t)
  }
  return { data: out, width, height: extra }
}

/** Same as extendTop for a side; rotating keeps one code path. `degrees` turns that side to the top. */
async function extendSide(photo: Raw, extra: number, degrees: 90 | -90) {
  const ext = await extendTop(await toRaw(fromRaw(photo).rotate(degrees)), extra)
  return toRaw(fromRaw(ext).rotate(-degrees))
}

/**
 * The whole photo, upright and uncropped, full width at its natural aspect at the bottom of a 1:1.05 frame; the space
 * above continues its top edge. A photo taller than the frame fills the height and continues its sides instead.
 */
export async function heroImage(input: Buffer): Promise<{ jpeg: Buffer; photo: { left: number; top: number; width: number; height: number } }> {
  const photo = await toRaw(sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize(HERO_WIDTH, HERO_HEIGHT, { fit: 'inside' }))
  const { width: w, height: h } = photo
  const left = Math.floor((HERO_WIDTH - w) / 2)
  const top = HERO_HEIGHT - h
  const parts: Raw[] = [photo]
  const at: [number, number][] = [[left, top]]
  if (top > 0) { parts.push(await extendTop(photo, top)); at.push([0, 0]) }
  if (left > 0) { parts.push(await extendSide(photo, left, 90)); at.push([0, top]) }
  const right = HERO_WIDTH - w - left
  if (right > 0) { parts.push(await extendSide(photo, right, -90)); at.push([left + w, top]) }
  const jpeg = await sharp({ create: { width: HERO_WIDTH, height: HERO_HEIGHT, channels: 3, background: '#000' } })
    .composite(parts.map((p, i) => ({ input: p.data, raw: { width: p.width, height: p.height, channels: 3 }, left: at[i][0], top: at[i][1] })))
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer()
  return { jpeg, photo: { left, top, width: w, height: h } }
}

const VERSION = 'v1' // bump when the look changes so cached copies regenerate
const pending = new Map<string, Promise<Buffer>>()

/**
 * The hero for an upload, made once and cached beside the uploads. `name` must already be a safe upload basename.
 * Undefined when the upload does not exist; rejects when the file is not a decodable image.
 */
export function heroFile(uploadsDir: string, name: string): Promise<Buffer> | undefined {
  const source = statSync(join(uploadsDir, name), { throwIfNoEntry: false })
  if (!source) return undefined
  const cached = join(uploadsDir, 'hero', `${name}.${VERSION}.jpg`)
  // Seed photos can be re-copied under the same name, so an older cache than its source is stale.
  if ((statSync(cached, { throwIfNoEntry: false })?.mtimeMs ?? -1) >= source.mtimeMs) return Promise.resolve(readFileSync(cached))
  let job = pending.get(cached)
  if (!job) {
    job = heroImage(readFileSync(join(uploadsDir, name))).then(({ jpeg }) => {
      mkdirSync(join(uploadsDir, 'hero'), { recursive: true })
      writeFileSync(`${cached}.tmp`, jpeg)
      renameSync(`${cached}.tmp`, cached) // never serve a half-written cache file
      return jpeg
    }).finally(() => pending.delete(cached))
    pending.set(cached, job)
  }
  return job
}
