import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { CATALOG, PACKS, RACE_EVENTS } from '../../shared/game/index.ts'
import type { LeaderboardMetric, LeaderboardScope } from '../../shared/api.ts'
import { login, register, requireAuth, type AuthedRequest } from './auth.ts'
import { GameError } from './errors.ts'
import * as game from './game.ts'

type Handler = (req: AuthedRequest, res: Response) => Promise<unknown>

/** Wraps an async handler: answers its value as JSON (201 for creations) and forwards errors. */
const json = (fn: Handler, status = 200) => (req: Request, res: Response, next: NextFunction) => {
  fn(req as AuthedRequest, res).then(v => res.status(status).json(v), next)
}

const str = (v: unknown) => String(v ?? '')

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '100kb' }))
  app.use((req, _res, next) => { console.log(`[http] ${req.method} ${req.path}`); next() })

  const api = express.Router()

  // Public
  api.get('/health', (_req, res) => { res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' }) })
  api.get('/catalog', (_req, res) => { res.json({ cars: CATALOG, packs: PACKS, events: RACE_EVENTS }) })
  api.post('/auth/register', json(req => register(req.body ?? {}), 201))
  api.post('/auth/login', json(req => login(req.body ?? {})))

  // Signed-in player
  api.use(requireAuth)
  api.get('/me', json(req => game.snapshot(req.uid)))
  api.put('/me', json(req => game.saveProfile(req.uid, req.body ?? {})))
  api.post('/me/onboarding', json(req => game.completeOnboarding(req.uid, req.body?.tastes)))

  api.post('/packs/free/open', json(req => game.claimFreePack(req.uid)))
  api.post('/packs/:packId/open', json(req => game.openPack(req.uid, str(req.params.packId))))

  api.post('/garage/:carId/upgrade', json(req => game.upgradeCar(req.uid, str(req.params.carId))))
  api.put('/garage/showcase', json(req => game.setShowcase(req.uid, req.body?.carIds)))

  api.post('/market/listings', json(req => game.listCar(req.uid, str(req.body?.carId), Number(req.body?.price)), 201))
  api.delete('/market/listings/:id', json(req => game.cancelListing(req.uid, str(req.params.id))))
  api.post('/market/listings/:id/buy', json(req => game.buyListing(req.uid, str(req.params.id))))
  api.post('/market/listings/:id/offers', json(req => game.makeOffer(req.uid, str(req.params.id), Number(req.body?.price))))

  api.post('/swaps', json(req => game.proposeSwap(req.uid, req.body ?? {}), 201))
  api.post('/swaps/:id/accept', json(req => game.acceptSwap(req.uid, str(req.params.id))))
  api.post('/swaps/:id/decline', json(req => game.declineSwap(req.uid, str(req.params.id))))

  api.post('/races', json(req => game.enterRace(req.uid, str(req.body?.eventId), str(req.body?.carId)), 201))
  api.post('/races/:id/finish', json(req => game.finishRace(req.uid, str(req.params.id), req.body?.shiftSteps)))

  api.post('/credits/top-up', json(req => game.topUp(req.uid, str(req.body?.bundleId))))
  api.post('/friends', json(req => game.addFriend(req.uid, str(req.body?.username)), 201))

  api.get('/leaderboard', json(req => {
    const metric = (['race', 'value', 'size'].includes(str(req.query.metric)) ? req.query.metric : 'race') as LeaderboardMetric
    const scope = (['global', 'friends', 'region'].includes(str(req.query.scope)) ? req.query.scope : 'global') as LeaderboardScope
    return game.leaderboard(req.uid, metric, scope)
  }))

  app.use('/api', api)
  app.use('/api', (_req, _res, next) => next(new GameError('not_found', 'Unknown route.')))

  // Errors: { error: { code, message, needed? } }
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GameError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, needed: err.needed } })
      return
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: { code: 'invalid', message: 'Malformed JSON body.' } })
      return
    }
    console.error('[http] Unexpected error', err)
    res.status(500).json({ error: { code: 'invalid', message: 'Something went wrong on the server.' } })
  })

  return app
}
