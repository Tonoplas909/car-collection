import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { type ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router'
import { routes } from './app.routes'
import { authInterceptor } from './core/auth.interceptor'
import { Store } from './core/store'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Restore the session before the first route renders.
    provideAppInitializer(() => inject(Store).init()),
  ],
}
