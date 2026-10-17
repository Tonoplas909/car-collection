import type { Routes } from '@angular/router'
import { onboardingGuard, sessionGuard } from './core/guards'
import { Shell } from './shell'
import { Credits, Events, Friends, SettingsPage, Upgrade } from './screens/extras/extras'
import { Garage } from './screens/garage/garage'
import { Landing } from './screens/landing/landing'
import { LeaderboardPage } from './screens/leaderboard/leaderboard'
import { Market } from './screens/market/market'
import { FirstPack, Login, SignUp, Tastes } from './screens/onboarding/onboarding'
import { PackReveal } from './screens/packs/pack-reveal'
import { Packs } from './screens/packs/packs'
import { Profile } from './screens/profile/profile'
import { RaceLive } from './screens/race/race-live'
import { RaceResults } from './screens/race/race-results'
import { RaceSetup } from './screens/race/race-setup'

export const routes: Routes = [
  { path: '', component: Landing, title: 'MARQUE' },
  { path: 'signup', component: SignUp, title: 'Sign up · MARQUE' },
  { path: 'login', component: Login, title: 'Log in · MARQUE' },
  { path: 'welcome/tastes', component: Tastes, canActivate: [onboardingGuard] },
  { path: 'welcome/pack', component: FirstPack, canActivate: [onboardingGuard] },

  // Full-screen views without the app chrome
  { path: 'packs/open', component: PackReveal, canActivate: [sessionGuard] },
  { path: 'race/live', component: RaceLive, canActivate: [sessionGuard] },
  { path: 'race/results', component: RaceResults, canActivate: [sessionGuard] },

  {
    path: '',
    component: Shell,
    canActivate: [sessionGuard],
    children: [
      { path: 'garage', component: Garage, title: 'Garage · MARQUE' },
      { path: 'garage/:carId', component: Garage, title: 'Garage · MARQUE' },
      { path: 'packs', component: Packs, title: 'Packs · MARQUE' },
      { path: 'market', component: Market, title: 'Market · MARQUE' },
      { path: 'market/:listingId', component: Market, title: 'Market · MARQUE' },
      { path: 'race', component: RaceSetup, title: 'Race · MARQUE' },
      { path: 'leaderboard', component: LeaderboardPage, title: 'Ranks · MARQUE' },
      { path: 'profile', component: Profile, title: 'Profile · MARQUE' },
      { path: 'settings', component: SettingsPage, title: 'Settings · MARQUE' },
      { path: 'credits', component: Credits, title: 'Credits · MARQUE' },
      { path: 'upgrade/:carId', component: Upgrade, title: 'Upgrade · MARQUE' },
      { path: 'events', component: Events, title: 'Events · MARQUE' },
      { path: 'friends', component: Friends, title: 'Friends · MARQUE' },
    ],
  },
  { path: '**', redirectTo: '' },
]
