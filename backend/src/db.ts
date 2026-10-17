import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import mongoose from 'mongoose'

let memory: { stop(): Promise<boolean> } | null = null

/**
 * Connects to MONGODB_URI, or starts an embedded MongoDB when it is not set so the API runs
 * locally with no install. `persist: false` gives a throwaway database (tests).
 */
export async function connect(uri = process.env.MONGODB_URI, { persist = true } = {}) {
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const dbPath = resolve('data/db')
    if (persist) mkdirSync(dbPath, { recursive: true })
    const server = await MongoMemoryServer.create(persist ? { instance: { dbPath, storageEngine: 'wiredTiger' } } : {})
    memory = server
    uri = server.getUri('marque')
    console.log(`[db] Embedded MongoDB${persist ? ` (data in ${dbPath})` : ''}`)
  }
  await mongoose.connect(uri)
  console.log(`[db] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`)
}

export async function disconnect() {
  await mongoose.disconnect()
  await memory?.stop()
  memory = null
}
