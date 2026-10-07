import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GlobalFx } from './components/GlobalFx'
import { AppShell, RequireSession } from './components/Shell'
import { CreditsPage, EventsPage, FriendsPage, SettingsPage, UpgradePage } from './screens/Extras'
import { GaragePage } from './screens/Garage'
import { LandingPage } from './screens/Landing'
import { LeaderboardPage } from './screens/Leaderboard'
import { MarketPage } from './screens/Market'
import { FirstPackPage, LoginPage, SignUpPage, TastesPage } from './screens/Onboarding'
import { PackRevealPage, PacksPage } from './screens/Packs'
import { ProfilePage } from './screens/Profile'
import { RaceLivePage, RaceResultsPage, RaceSetupPage } from './screens/Race'
import { useApp } from './state/store'

export function App() {
  const ready = useApp(s => s.status === 'ready')
  if (!ready) return null
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <GlobalFx />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome/tastes" element={<TastesPage />} />
        <Route path="/welcome/pack" element={<FirstPackPage />} />

        <Route element={<AppShell />}>
          <Route path="/garage" element={<GaragePage />} />
          <Route path="/garage/:carId" element={<GaragePage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/market/:listingId" element={<MarketPage />} />
          <Route path="/race" element={<RaceSetupPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/upgrade/:carId" element={<UpgradePage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/friends" element={<FriendsPage />} />
        </Route>

        <Route path="/packs/open" element={<RequireSession><PackRevealPage /></RequireSession>} />
        <Route path="/race/live" element={<RequireSession><RaceLivePage /></RequireSession>} />
        <Route path="/race/results" element={<RequireSession><RaceResultsPage /></RequireSession>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
