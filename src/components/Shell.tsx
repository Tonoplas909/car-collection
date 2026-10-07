import type { CSSProperties, ReactNode } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { num } from '../lib/format'
import { useIsMobile } from '../lib/hooks'
import { useApp } from '../state/store'

const PRIMARY = [
  ['/garage', 'Garage'], ['/packs', 'Packs'], ['/race', 'Race'], ['/market', 'Market'], ['/leaderboard', 'Leaderboard'],
] as const
const SECONDARY = [['/events', 'Events'], ['/friends', 'Friends'], ['/settings', 'Settings']] as const

function RailNav() {
  const user = useApp(s => s.snapshot?.user)
  const linkClass = ({ isActive }: { isActive: boolean }) => `rail-link${isActive ? ' active' : ''}`
  return (
    <nav className="rail" aria-label="Main">
      <NavLink to="/garage" className="rail-brand">MARQUE</NavLink>
      {PRIMARY.map(([to, label]) => <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>)}
      <div className="rail-sep" />
      {SECONDARY.map(([to, label]) => <NavLink key={to} to={to} className={linkClass}>{label}</NavLink>)}
      {user && (
        <NavLink to="/profile" className={({ isActive }) => `rail-player${isActive ? ' active' : ''}`}>
          <span className="label">Credits</span>
          <span className="credits">{num(user.credits)}</span>
          <span className="muted" style={{ fontSize: 13, paddingTop: 8 }}>{user.username} · Lv {user.level}</span>
        </NavLink>
      )}
    </nav>
  )
}

function TabBar() {
  const { pathname } = useLocation()
  const onProfile = pathname.startsWith('/profile')
  // Full-screen detail views (2b) replace the tab bar with their own action bar.
  if (/^\/(garage|market)\/[^/]+/.test(pathname)) return null
  const tabs: [string, string][] = [
    ['/garage', 'Garage'], ['/packs', 'Packs'], ['/race', 'Race'], ['/market', 'Market'],
    onProfile ? ['/profile', 'Profile'] : ['/leaderboard', 'Ranks'],
  ]
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}
    </nav>
  )
}

/** Layout for signed-in screens: rail nav on desktop, bottom tab bar on phones. */
export function AppShell() {
  const mobile = useIsMobile()
  const signedIn = useApp(s => !!s.snapshot)
  if (!signedIn) return <Navigate to="/" replace />
  if (mobile) {
    return (
      <div className="mshell">
        <div className="mshell-body"><Outlet /></div>
        <TabBar />
      </div>
    )
  }
  return (
    <div className="shell">
      <RailNav />
      <Outlet />
    </div>
  )
}

/** Requires a session, without the app chrome (pack reveal, live race, results). */
export function RequireSession({ children }: { children: ReactNode }) {
  const signedIn = useApp(s => !!s.snapshot)
  return signedIn ? <>{children}</> : <Navigate to="/" replace />
}

export function Main({ children, scroll, className = '' }: { children: ReactNode; scroll?: boolean; className?: string }) {
  return <main className={`shell-main${scroll ? ' scroll' : ''} ${className}`}>{children}</main>
}

export function Aside({ width, children, className = '' }: { width: number; children: ReactNode; className?: string }) {
  return <aside className={`shell-aside ${className}`} style={{ '--aside': `${width}px` } as CSSProperties}>{children}</aside>
}

/** Phone header: big title on the left, credits on the right. */
export function MobileHead({ title, right }: { title: ReactNode; right?: ReactNode }) {
  const credits = useApp(s => s.snapshot?.user.credits ?? 0)
  return (
    <div className="m-head">
      <span className="m-title">{title}</span>
      {right ?? <span className="m-credits">{num(credits)} CR</span>}
    </div>
  )
}
