/**
 * Servers seeded by v1 still name the demo accounts "Omar Fathy (sample)"; server/seed.ts upgradeSeed fixes the data,
 * this covers an API that hasn't restarted since. Only person and business name fields are touched.
 */
export function withoutSampleSuffix(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSampleSuffix)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([k, v]) =>
    [k, (k === 'name' || k === 'businessName') && typeof v === 'string' ? v.replace(/ \(sample\)$/, '') : withoutSampleSuffix(v)]))
}
