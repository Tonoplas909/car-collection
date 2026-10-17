import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, input, signal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import type { Settings } from '@api'
import { CARS_BY_ID, CREDIT_BUNDLES, MAX_LEVEL, UPGRADE_DELTA, VAT, upgradeCost, upgradedStats, type RaceEventId } from '@game'
import { cr, euro, num, remaining } from '../../core/format'
import { errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { Nav, Viewport, clockSignal } from '../../core/ui'
import { ConfirmDialog } from '../../shared/confirm-dialog'
import { MobileHead } from '../../shared/mobile-head'
import { Photo } from '../../shared/photo'

const val = (e: Event) => (e.target as HTMLInputElement).value

/* ── 8a Settings ────────────────────────────────────────────────────── */

const PREFS: [keyof Settings, string, string][] = [
  ['sound', 'Sound effects', 'Engine and pack sounds'],
  ['reduceMotion', 'Reduce motion', 'Skip reveal and sweep animations'],
  ['notifications', 'Race notifications', 'When a friend challenges you'],
  ['showGarageValue', 'Show my garage value', 'On your public profile'],
]

@Component({
  selector: 'app-settings',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, MobileHead],
  templateUrl: './settings.html',
})
export class SettingsPage {
  private store = inject(Store)
  private nav = inject(Nav)
  protected vp = inject(Viewport)
  protected val = val
  protected readonly prefList = PREFS
  protected readonly tabs = ['Account', 'Notifications', 'Privacy', 'Payments', 'Language']

  private user = this.store.snap().user
  protected form = signal({ username: this.user.username, email: this.user.email, region: this.user.region })
  protected prefs = signal<Settings>({ ...this.user.settings })
  protected status = signal<'idle' | 'saving' | 'saved' | 'error'>('idle')
  protected error = signal('')
  protected dirty = computed(() => {
    const u = this.store.snap().user, f = this.form()
    return f.username !== u.username || f.email !== u.email || f.region !== u.region || JSON.stringify(this.prefs()) !== JSON.stringify(u.settings)
  })

  protected set(k: 'username' | 'email' | 'region', e: Event) {
    this.form.update(f => ({ ...f, [k]: val(e) }))
  }

  protected toggle(k: keyof Settings) {
    this.prefs.update(p => ({ ...p, [k]: !p[k] }))
  }

  protected async save(e?: Event) {
    e?.preventDefault()
    this.status.set('saving')
    try {
      await this.store.saveProfile({ ...this.form(), settings: this.prefs() })
      this.status.set('saved')
    } catch (err) {
      this.error.set(errorMessage(err))
      this.status.set('error')
    }
  }

  protected logout() {
    this.store.signOut()
    this.nav.go('/')
  }
}

/* ── 8b Credits top-up ──────────────────────────────────────────────── */

@Component({
  selector: 'app-credits',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, ConfirmDialog, MobileHead],
  templateUrl: './credits.html',
})
export class Credits {
  protected store = inject(Store)
  private nav = inject(Nav)
  protected vp = inject(Viewport)
  protected cr = cr
  protected num = num
  protected euro = euro
  protected readonly bundles = CREDIT_BUNDLES
  protected sel = signal(1)
  protected busy = signal(false)
  protected done = signal<number | null>(null)
  protected error = signal('')
  protected b = computed(() => CREDIT_BUNDLES[this.sel()])
  protected vat = computed(() => Math.round(this.b().priceCents * VAT))
  protected doneRows = computed<[string, string][]>(() => [['New balance', cr(this.store.credits())]])

  protected async pay() {
    this.busy.set(true)
    this.error.set('')
    try {
      await this.store.topUp(this.b().id)
      this.done.set(this.b().credits)
    } catch (e) {
      this.error.set(errorMessage(e))
    } finally {
      this.busy.set(false)
    }
  }

  protected toShop() {
    this.done.set(null)
    this.nav.go('/packs')
  }
}

/* ── 8c Car upgrade ─────────────────────────────────────────────────── */

@Component({
  selector: 'app-upgrade',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, RouterLink, Photo],
  templateUrl: './upgrade.html',
})
export class Upgrade {
  /** Route parameter (/upgrade/:carId) */
  readonly carId = input.required<string>()
  protected store = inject(Store)
  private nav = inject(Nav)
  private router = inject(Router)
  protected vp = inject(Viewport)
  protected cr = cr
  protected num = num
  protected busy = signal(false)
  protected error = signal('')
  protected readonly levels = Array.from({ length: MAX_LEVEL }, (_, i) => i)
  protected readonly maxLevel = MAX_LEVEL

  protected owned = computed(() => this.store.snap().garage.find(g => g.carId === this.carId()))
  protected car = computed(() => CARS_BY_ID[this.carId()])
  protected lvl = computed(() => this.owned()?.level ?? 0)
  protected maxed = computed(() => this.lvl() >= MAX_LEVEL)
  protected cost = computed(() => upgradeCost(this.lvl()))
  protected short = computed(() => this.cost() !== null && this.store.credits() < this.cost()!)
  protected stats = computed(() => {
    const now = upgradedStats(this.car(), this.lvl()), maxed = this.maxed()
    return [
      { k: 'Power', v: `${now.hp} hp`, d: maxed ? '' : `+${UPGRADE_DELTA.hp} hp next` },
      { k: '0–100', v: `${now.acc.toFixed(1)} s`, d: maxed ? '' : `−${Math.abs(UPGRADE_DELTA.acc).toFixed(1)} s next` },
      { k: 'Top speed', v: `${now.top} km/h`, d: maxed ? '' : `+${UPGRADE_DELTA.top} km/h next` },
      { k: 'Weight', v: `${num(now.kg)} kg`, d: maxed ? '' : `−${Math.abs(UPGRADE_DELTA.kg)} kg next` },
    ]
  })
  protected parts = computed(() => {
    const l = this.lvl()
    return [
      { k: 'Engine tune', d: `+${UPGRADE_DELTA.hp} hp per level`, lv: l },
      { k: 'Gearbox', d: 'Shorter ratios', lv: Math.min(l, 3) },
      { k: 'Tires', d: 'Better launch', lv: Math.min(l, 2) },
      { k: 'Lightweight kit', d: `−${Math.abs(UPGRADE_DELTA.kg)} kg per level`, lv: l },
    ]
  })
  protected label = computed(() => this.maxed() ? 'Max level reached' : this.short() ? `Top up to upgrade · ${cr(this.cost()!)}` : `Upgrade for ${cr(this.cost()!)}`)

  ngOnInit() {
    if (!this.owned() || !this.car()) void this.router.navigateByUrl('/garage', { replaceUrl: true })
  }

  protected async up() {
    if (this.short()) { this.nav.go('/credits'); return }
    this.busy.set(true)
    this.error.set('')
    try { await this.store.upgradeCar(this.carId()) } catch (e) { this.error.set(errorMessage(e)) } finally { this.busy.set(false) }
  }
}

/* ── 8d Events ──────────────────────────────────────────────────────── */

@Component({
  selector: 'app-events',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, MobileHead],
  template: `
    <ng-template #list>
      @for (e of store.snap().events; track e.id; let i = $index) {
        <div class="ev-row list-row" [class.hot]="e.featured" [style.--i]="i">
          <div style="display: flex; flex-direction: column">
            <span class="label" style="color: inherit">{{ weekday(e.date) }}</span>
            <span class="ev-date">{{ day(e.date) }}</span>
          </div>
          <div style="display: flex; flex-direction: column"><span class="ev-name">{{ e.name }}</span><span style="font-size: 13px">{{ e.rule }}</span></div>
          <div style="display: flex; flex-direction: column"><span class="label" style="color: inherit">Prize</span><span style="font-weight: 800">{{ e.prize }}</span></div>
          <button class="ev-cta" (click)="enter(e.eventId)">Enter · {{ cr(e.fee) }}</button>
        </div>
      }
    </ng-template>
    @if (vp.mobile()) {
      <app-mobile-head title="Events" [custom]="true"><span class="m-credits">{{ left() }} left</span></app-mobile-head>
      <div class="mscroll"><ng-container *ngTemplateOutlet="list" /></div>
    } @else {
      <main class="shell-main">
        <div class="page-head">
          <span class="page-title">Events</span>
          <span class="meta">Season {{ store.snap().season }} · {{ left() }} left</span>
        </div>
        <div style="overflow: auto; flex: 1"><ng-container *ngTemplateOutlet="list" /></div>
      </main>
    }
  `,
})
export class Events {
  protected store = inject(Store)
  private nav = inject(Nav)
  protected vp = inject(Viewport)
  private now = clockSignal(60_000)
  protected cr = cr
  protected left = computed(() => remaining(this.store.snap().seasonEndsAt - this.now()))
  protected weekday = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short' })
  protected day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  protected enter(eventId: RaceEventId) {
    this.store.setRace({ eventId })
    this.nav.go('/race')
  }
}

/* ── 8e Friends ─────────────────────────────────────────────────────── */

@Component({
  selector: 'app-friends',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, MobileHead],
  templateUrl: './friends.html',
})
export class Friends {
  protected store = inject(Store)
  protected nav = inject(Nav)
  protected vp = inject(Viewport)
  protected num = num
  protected val = val
  protected sel = signal(0)
  protected name = signal('')
  protected error = signal('')
  protected friends = computed(() => this.store.snap().friends)
  protected f = computed(() => this.friends()[this.sel()] ?? this.friends()[0])

  protected async add(e: Event) {
    e.preventDefault()
    this.error.set('')
    try {
      await this.store.addFriend(this.name())
      this.name.set('')
    } catch (err) {
      this.error.set(errorMessage(err))
    }
  }
}
