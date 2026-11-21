/** The photo page a horizontal pager rests on, kept inside 0..count-1 (bounce and rounding can overshoot). */
export const pageAt = (offsetX: number, width: number, count: number) =>
  width > 0 && count > 0 ? Math.min(count - 1, Math.max(0, Math.round(offsetX / width))) : 0

/** How far a photo may fall short of the hero's minimum and still set the height itself, so near misses get no thin blur strips. */
const SLACK = 16

/**
 * Listing hero height for the photo on screen: its natural height at full width, kept between a minimum (shorter photos
 * get a blurred fill) and a screen-relative maximum (taller ones fit inside). Unknown dimensions use the minimum.
 */
export function heroHeight(width: number, screenHeight: number, aspect?: number) {
  const max = Math.round(Math.min(width * 1.25, screenHeight * 0.6))
  const min = Math.min(Math.round(width * 0.62), max)
  if (!(aspect! > 0)) return min
  const natural = width / aspect!
  return natural > max ? max : natural >= min - SLACK ? Math.round(natural) : min
}

/**
 * The whole photo fitted inside a frame and centered. `fill` is true when a short photo leaves room above and below.
 * Within a point of an edge it snaps to it so no hairline gap shows.
 */
export function fitRect(width: number, height: number, aspect: number) {
  let w = Math.min(width, height * aspect)
  let h = Math.min(height, width / aspect)
  if (width - w < 1) w = width
  if (height - h < 1) h = height
  return { left: (width - w) / 2, top: (height - h) / 2, width: w, height: h, fill: h < height }
}
