import { Component, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core'
import { NgTemplateOutlet } from '@angular/common'
import { CARS_BY_ID, TIER_RANK, type Tier } from '@game'
import { cr } from '../../core/format'
import { Store } from '../../core/store'
import { Nav, Viewport } from '../../core/ui'
import { EmptyState } from '../../shared/empty-state'
import { MobileHead } from '../../shared/mobile-head'
import { TierFilter } from '../../shared/tier-filter'
import { CarCard } from './car-card'
import { CarPanel, type GarageItem } from './car-panel'

type Sort = 'tier' | 'hp' | 'value' | 'year'
const SORTERS: Record<Sort, (a: GarageItem, b: GarageItem) => number> = {
  tier: (a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.value - a.car.value,
  hp: (a, b) => b.car.hp - a.car.hp,
  value: (a, b) => b.car.value - a.car.value,
  year: (a, b) => a.car.year - b.car.year,
}

/** Garage: collection grid with the side panel (1b), or list + full-screen detail on phones (2a, 2b). */
@Component({
  selector: 'app-garage',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, CarCard, CarPanel, EmptyState, MobileHead, TierFilter],
  templateUrl: './garage.html',
})
export class Garage {
  /** Route parameter (/garage/:carId) */
  readonly carId = input<string>()
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected nav = inject(Nav)
  private injector = inject(Injector)
  protected cr = cr
  protected pad3 = (n: number) => String(n).padStart(3, '0')
  protected readonly sorts: [Sort, string][] = [['tier', 'Rarity'], ['hp', 'Power'], ['value', 'Value'], ['year', 'Year']]

  protected filter = signal<Tier | 'All'>('All')
  protected sort = signal<Sort>('tier')
  private picked = signal<string | undefined>(undefined)
  private panel = viewChild(CarPanel)

  protected items = computed<GarageItem[]>(() =>
    this.store.snap().garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(i => i.car))
  protected counts = computed(() => {
    const c = { All: this.items().length, Common: 0, Rare: 0, Epic: 0, Legendary: 0 } as Record<Tier | 'All', number>
    for (const i of this.items()) c[i.car.tier]++
    return c
  })
  protected total = computed(() => this.items().reduce((a, i) => a + i.car.value, 0))
  protected list = computed(() => this.items().filter(i => this.filter() === 'All' || i.car.tier === this.filter()).sort(SORTERS[this.sort()]))
  protected current = computed(() => {
    const sel = this.picked() ?? this.carId()
    return this.items().find(i => i.carId === sel) ?? [...this.items()].sort(SORTERS.tier)[0]
  })
  protected detail = computed(() => this.items().find(i => i.carId === this.carId()))

  protected pick(i: GarageItem) {
    if (i.carId === this.current()?.carId) return
    this.picked.set(i.carId)
    afterNextRender(() => this.panel()?.animate(), { injector: this.injector })
  }
}
