import { Component, computed, inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { filter, map } from 'rxjs'
import { num } from './core/format'
import { Store } from './core/store'
import { Viewport } from './core/ui'

/** Layout for signed-in screens: rail nav (desktop, 200 px) or bottom tab bar (phones). */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (vp.mobile()) {
      <div class="mshell">
        <div class="mshell-body"><router-outlet /></div>
        @if (!detail()) {
          <nav class="tabbar" aria-label="Main">
            @for (t of tabs(); track t[0]) {
              <a [routerLink]="t[0]" routerLinkActive="active">{{ t[1] }}</a>
            }
          </nav>
        }
      </div>
    } @else {
      <div class="shell">
        <nav class="rail" aria-label="Main">
          <a routerLink="/garage" class="rail-brand">MARQUE</a>
          @for (l of primary; track l[0]) {
            <a [routerLink]="l[0]" class="rail-link" routerLinkActive="active">{{ l[1] }}</a>
          }
          <div class="rail-sep"></div>
          @for (l of secondary; track l[0]) {
            <a [routerLink]="l[0]" class="rail-link" routerLinkActive="active">{{ l[1] }}</a>
          }
          @if (store.user(); as u) {
            <a routerLink="/profile" class="rail-player" routerLinkActive="active">
              <span class="label">Credits</span>
              <span class="credits">{{ num(u.credits) }}</span>
              <span class="muted" style="font-size: 13px; padding-top: 8px">{{ u.username }} · Lv {{ u.level }}</span>
            </a>
          }
        </nav>
        <router-outlet />
      </div>
    }
  `,
})
export class Shell {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected num = num
  private router = inject(Router)
  protected readonly primary = [['/garage', 'Garage'], ['/packs', 'Packs'], ['/race', 'Race'], ['/market', 'Market'], ['/leaderboard', 'Leaderboard']] as const
  protected readonly secondary = [['/events', 'Events'], ['/friends', 'Friends'], ['/settings', 'Settings']] as const

  private path = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url.split('?')[0])),
    { initialValue: this.router.url.split('?')[0] },
  )
  /** Full-screen detail views (2b) replace the tab bar with their own action bar. */
  protected detail = computed(() => /^\/(garage|market)\/[^/]+/.test(this.path()))
  protected tabs = computed(() => [
    ['/garage', 'Garage'], ['/packs', 'Packs'], ['/race', 'Race'], ['/market', 'Market'],
    this.path().startsWith('/profile') ? ['/profile', 'Profile'] : ['/leaderboard', 'Ranks'],
  ])
}
