import { Component, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { map } from 'rxjs'
import type { SwapOffer } from '@api'
import { CARS_BY_ID, carLabel, marketFee, type Car, type Tier } from '@game'
import { compact, cr, num, remaining } from '../../core/format'
import { Store } from '../../core/store'
import { TIER_BAR, TIER_FG } from '../../core/tiers'
import { Nav, Viewport, clockSignal } from '../../core/ui'
import { EmptyState } from '../../shared/empty-state'
import { MobileHead } from '../../shared/mobile-head'
import { Photo } from '../../shared/photo'
import { TierFilter } from '../../shared/tier-filter'
import { ListingPanel } from './listing-panel'
import { MarketDialogs } from './market-dialogs'
import { SORTERS, delta, deltaStr, type DialogState, type Row, type Sort } from './market-data'

type Tab = 'buy' | 'sell' | 'mine' | 'offers'
const TABS: [Tab, string][] = [['buy', 'Buy'], ['sell', 'Sell'], ['mine', 'My listings'], ['offers', 'Offers']]

/** Market: listings table + detail panel (3c), Buy/Sell/Swap on phones (6b). */
@Component({
  selector: 'app-market',
  host: { class: 'screen' },
  imports: [EmptyState, MobileHead, Photo, TierFilter, ListingPanel, MarketDialogs],
  templateUrl: './market.html',
})
export class Market {
  /** Route parameter (/market/:listingId, phones) */
  readonly listingId = input<string>()
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected nav = inject(Nav)
  private router = inject(Router)
  private injector = inject(Injector)
  protected now = clockSignal(30_000)
  protected readonly tabs = TABS
  protected cr = cr
  protected num = num
  protected compact = compact
  protected remaining = remaining
  protected label = carLabel
  protected marketFee = marketFee
  protected delta = delta
  protected deltaStr = deltaStr
  protected cars = CARS_BY_ID
  protected TIER_BAR = TIER_BAR
  protected TIER_FG = TIER_FG

  protected tab = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(q => (TABS.find(([t]) => t === q.get('tab'))?.[0] ?? 'buy') as Tab)), { initialValue: 'buy' as Tab })
  protected filter = signal<Tier | 'All'>('All')
  protected sort = signal<Sort>('tier')
  protected seg = signal<'Buy' | 'Sell' | 'Swap'>('Buy')
  protected dialog = signal<DialogState>(null)
  private sel = signal<string | null>(null)
  private panel = viewChild(ListingPanel)
  private busyCancel = signal<string | null>(null)

  protected snap = computed(() => this.store.snap())
  protected rows = computed<Row[]>(() => this.snap().listings.map(l => ({ ...l, car: CARS_BY_ID[l.carId] })).filter(r => r.car))
  protected buyRows = computed(() => this.rows().filter(r => !r.mine && (this.filter() === 'All' || r.car.tier === this.filter())).sort(SORTERS[this.sort()]))
  protected live = computed(() => this.rows().filter(r => !r.mine).length)
  protected current = computed(() => this.buyRows().find(r => r.id === this.sel()) ?? this.rows().find(r => r.id === this.sel() && !r.mine) ?? this.buyRows()[0])
  protected incoming = computed(() => this.snap().offers.filter(o => o.incoming).length)
  protected mineRows = computed(() => this.rows().filter(r => r.mine))
  protected sellable = computed(() => this.snap().garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car).sort((a, b) => b.car.value - a.car.value))
  protected mobileBuy = computed(() => this.rows().filter(r => !r.mine).sort(SORTERS.tier))
  protected detail = computed(() => this.rows().find(r => r.id === this.listingId()))

  protected setTab(t: Tab) {
    void this.router.navigate([], { queryParams: t === 'buy' ? {} : { tab: t } })
  }

  protected pick(r: Row) {
    if (r.id === this.current()?.id) return
    this.sel.set(r.id)
    afterNextRender(() => this.panel()?.animate(), { injector: this.injector })
  }

  protected toggleSort() {
    this.sort.set(this.sort() === 'priceDesc' ? 'priceAsc' : 'priceDesc')
  }

  protected async cancel(id: string) {
    this.busyCancel.set(id)
    try { await this.store.cancelListing(id) } finally { this.busyCancel.set(null) }
  }
  protected cancelling = (id: string) => this.busyCancel() === id

  protected open(d: DialogState) { this.dialog.set(d) }
  protected sell(car: Car) { this.dialog.set({ kind: 'sell', car }) }
  protected swap(o: SwapOffer) { this.dialog.set({ kind: 'swap', offer: o }) }
  protected decline(o: SwapOffer) { void this.store.declineSwap(o.id) }
}
