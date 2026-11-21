import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withoutSampleSuffix } from './sampleNames.ts'

test('drops the v1 "(sample)" suffix from names only', () => {
  const owner = { name: 'Omar Fathy (sample)', businessName: 'Nile Fleet Rentals (sample)' }
  assert.deepEqual(withoutSampleSuffix({ listings: [{ terms: 'No smoking (sample)', owner }], contact: { name: 'Mona (sample) Sherif' } }),
    { listings: [{ terms: 'No smoking (sample)', owner: { name: 'Omar Fathy', businessName: 'Nile Fleet Rentals' } }], contact: { name: 'Mona (sample) Sherif' } })
  assert.equal(withoutSampleSuffix(null), null)
})
