/** The photo page a horizontal pager rests on, kept inside 0..count-1 (bounce and rounding can overshoot). */
export const pageAt = (offsetX: number, width: number, count: number) =>
  width > 0 && count > 0 ? Math.min(count - 1, Math.max(0, Math.round(offsetX / width))) : 0
