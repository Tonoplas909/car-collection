import bcrypt from 'bcryptjs'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthResponse } from '../../shared/api.ts'
import { GameError } from './errors.ts'
import { snapshot } from './game.ts'
import { User } from './models.ts'

// The secret stays on the server; the Angular app only ever sees the signed token.
const SECRET = process.env.JWT_SECRET || 'marque-local-development-secret'

export interface AuthedRequest extends Request {
  uid: string
}

function sign(uid: string) {
  return jwt.sign({ sub: uid }, SECRET, { expiresIn: '7d' })
}

/** Protects a route: needs `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers.authorization
  if (!raw?.startsWith('Bearer ')) return next(new GameError('unauthenticated', 'Sign in to continue.'))
  try {
    const payload = jwt.verify(raw.slice(7), SECRET) as { sub: string }
    ;(req as AuthedRequest).uid = payload.sub
    next()
  } catch {
    next(new GameError('unauthenticated', 'Your session has expired. Log in again.'))
  }
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10)

export async function register(body: { username?: string; email?: string; password?: string }): Promise<AuthResponse> {
  const username = String(body.username ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (username.length < 3 || username.length > 24) throw new GameError('invalid', 'Usernames are 3 to 24 characters.')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new GameError('invalid', 'Enter a valid email.')
  if (password.length < 8) throw new GameError('invalid', 'Passwords are at least 8 characters.')
  if (await User.exists({ email })) throw new GameError('invalid', 'An account with this email already exists. Log in instead.', undefined, 409)
  if (await User.exists({ username })) throw new GameError('invalid', 'This username is taken.', undefined, 409)
  const user = await User.create({ username, email, passwordHash: await hashPassword(password) })
  console.log(`[auth] New player ${username}`)
  return { token: sign(user.id), snapshot: await snapshot(user.id) }
}

export async function login(body: { email?: string; password?: string }): Promise<AuthResponse> {
  const email = String(body.email ?? '').trim().toLowerCase()
  const user = await User.findOne({ email }).select('+passwordHash')
  // Same message for an unknown email and a wrong password, so accounts cannot be probed.
  if (!user || !(await bcrypt.compare(String(body.password ?? ''), user.passwordHash))) {
    throw new GameError('unauthenticated', 'Wrong email or password.')
  }
  return { token: sign(user.id), snapshot: await snapshot(user.id) }
}
