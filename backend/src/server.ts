import { createApp } from './app.ts'
import { connect } from './db.ts'
import { ensureSeasonAndEvents } from './game.ts'
import { seedIfEmpty } from './seed/index.ts'

const port = Number(process.env.PORT) || 3000

await connect()
await seedIfEmpty()
await ensureSeasonAndEvents()

const server = createApp().listen(port, () => {
  console.log(`[startup] MARQUE API on http://localhost:${port}/api/health`)
})
server.on('error', error => console.error(`[startup] Cannot listen on port ${port}`, error))
