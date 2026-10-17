import { NgTemplateOutlet } from '@angular/common'
import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, viewChild } from '@angular/core'
import { CARS_BY_ID, OPPONENTS, RACE_EVENTS, RACE_EVENTS_BY_ID, TIER_RANK, type RaceEventId } from '@game'
import { cr, num } from '../../core/format'
import { animateRacePanel, sweep } from '../../core/motion'
import { Store } from '../../core/store'
import { TIER_BAR } from '../../core/tiers'
import { Viewport } from '../../core/ui'
import { ConfirmDialog } from '../../shared/confirm-dialog'
import { EmptyState } from '../../shared/empty-state'
import { MobileHead } from '../../shared/mobile-head'
import { Photo } from '../../shared/photo'
import { FindRace } from './find-race'

/** Race setup: event + car (5a desktop, 6e mobile). Picking one sweeps a black slab across it. */
@Component({
  selector: 'app-race-setup',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, ConfirmDialog, EmptyState, MobileHead, Photo],
  providers: [FindRace],
  templateUrl: './race-setup.html',
})
export class RaceSetup {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected fr = inject(FindRace)
  private injector = inject(Injector)
  protected cr = cr
  protected num = num
  protected TIER_BAR = TIER_BAR
  protected readonly events = RACE_EVENTS
  protected readonly opponents = OPPONENTS
  protected lenStr = (len: number) => `${num(len)} m`
  protected hpt = (hp: number, kg: number) => Math.round((hp / kg) * 1000)

  protected cars = computed(() => this.store.snap().garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car)
    .sort((a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.hp - a.car.hp))
  protected current = computed(() => this.cars().find(c => c.carId === this.store.race().carId) ?? this.cars()[0])
  protected ev = computed(() => RACE_EVENTS_BY_ID[this.store.race().eventId])
  protected shortRows = computed<[string, string][]>(() => { const s = this.fr.short(); return s ? [['Entry fee', cr(s.fee)]] : [] })

  private hdr = viewChild<ElementRef<HTMLElement>>('hdr')
  private title = viewChild<ElementRef<HTMLElement>>('title')
  private opps = viewChild<ElementRef<HTMLElement>>('opps')
  private rewards = viewChild<ElementRef<HTMLElement>>('rewards')
  private note = viewChild<ElementRef<HTMLElement>>('note')

  constructor() {
    // Keep the store's selection on a car the player owns.
    effect(() => {
      const c = this.current()
      if (c && c.carId !== this.store.race().carId) this.store.setRace({ carId: c.carId })
    })
  }

  private animatePanel() {
    afterNextRender(() => animateRacePanel({
      hdr: this.hdr()?.nativeElement, title: this.title()?.nativeElement, opps: this.opps()?.nativeElement,
      rewards: this.rewards()?.nativeElement, note: this.note()?.nativeElement,
    }), { injector: this.injector })
  }

  protected pickEvent(id: RaceEventId, e: Event) {
    if (id === this.ev().id) return
    if (!this.vp.mobile()) { sweep(e.currentTarget as HTMLElement); this.animatePanel() }
    this.store.setRace({ eventId: id })
  }

  protected pickCar(carId: string, e: Event) {
    if (carId === this.current()?.carId) return
    if (!this.vp.mobile()) { sweep(e.currentTarget as HTMLElement); this.animatePanel() }
    this.store.setRace({ carId })
  }
}
