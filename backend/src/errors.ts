import type { GameErrorCode } from '../../shared/api.ts'

const STATUS: Record<GameErrorCode, number> = {
  invalid: 400,
  unauthenticated: 401,
  insufficient_credits: 402,
  not_found: 404,
  not_configured: 501,
}

/** A rule violation the client should explain (not enough credits, car listed, ...). */
export class GameError extends Error {
  readonly code: GameErrorCode
  readonly needed?: number
  readonly status: number

  constructor(code: GameErrorCode, message: string, needed?: number, status = STATUS[code]) {
    super(message)
    this.code = code
    this.needed = needed
    this.status = status
  }
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
