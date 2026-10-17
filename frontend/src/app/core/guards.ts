import { inject } from '@angular/core'
import { type CanActivateFn, Router } from '@angular/router'
import { Store } from './store'

/** Signed-in screens: back to the landing page without a session. */
export const sessionGuard: CanActivateFn = () => inject(Store).signedIn() || inject(Router).createUrlTree(['/'])

/** Onboarding steps 2–3 need the account created in step 1. */
export const onboardingGuard: CanActivateFn = () => inject(Store).signedIn() || inject(Router).createUrlTree(['/signup'])
