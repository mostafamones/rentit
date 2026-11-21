import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHandler } from './app.ts'
import { openDb } from './db.ts'
import { seedIfEmpty, upgradeSeed } from './seed.ts'

const dataDir = resolve(process.env.DATA_DIR ?? join(import.meta.dirname, '..', 'data'))
const uploadsDir = join(dataDir, 'uploads')
mkdirSync(uploadsDir, { recursive: true })
const db = openDb(join(dataDir, 'rentit.db'))
if (process.env.SEED !== 'false') {
  if (seedIfEmpty(db, uploadsDir)) console.log('Seeded sample listings.')
  else upgradeSeed(db, uploadsDir)
}

const port = Number(process.env.PORT ?? 4000)
createServer(createHandler({ db, uploadsDir })).listen(port, '0.0.0.0', () => {
  console.log(`Rentit API on http://0.0.0.0:${port} (data in ${dataDir})`)
})
