import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http'
import { catchError, throwError } from 'rxjs'
import type { ApiErrorBody } from '@api'
import { GameError } from './game-error'

export const TOKEN_KEY = 'marque.token'

export function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

/** Adds `Authorization: Bearer <token>` to API calls and turns error bodies into GameError. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readToken()
  const authed = token && req.url.startsWith('/api') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as Partial<ApiErrorBody> | null
        if (body?.error) return throwError(() => new GameError(body.error!.code, body.error!.message, body.error!.needed))
        if (err.status === 0) return throwError(() => new GameError('invalid', 'The server is not reachable. Is the backend running?'))
        return throwError(() => new GameError('invalid', `Server error (${err.status}).`))
      }
      return throwError(() => err)
    }),
  )
}
