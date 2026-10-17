import type { GameErrorCode } from '@api'

/** Raised for rule violations the UI should explain (not enough credits, car listed, ...). */
export class GameError extends Error {
  code: GameErrorCode
  needed?: number
  constructor(code: GameErrorCode, message: string, needed?: number) {
    super(message)
    this.code = code
    this.needed = needed
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))
