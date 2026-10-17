// npm run seed:reset — wipes the database and loads the demo data again.
import mongoose from 'mongoose'
import { connect, disconnect } from './db.ts'
import { ensureSeasonAndEvents } from './game.ts'
import { seedIfEmpty } from './seed/index.ts'

await connect()
await mongoose.connection.dropDatabase()
console.log('[seed] Database dropped')
await seedIfEmpty()
await ensureSeasonAndEvents()
await disconnect()
