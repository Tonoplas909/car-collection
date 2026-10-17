import { Component, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core'
import type { OwnedCar } from '@game'
import { makeGen, type Car } from '@game'
import { cr, num, serial } from '../../core/format'
import { animatePanel } from '../../core/motion'
import { Store } from '../../core/store'
import { Nav } from '../../core/ui'
import { ChevronLeft } from '../../shared/icons'
import { Photo } from '../../shared/photo'
import { SellDialog } from '../sell-dialog'

export type GarageItem = OwnedCar & { car: Car }

/** Garage side panel (1b), or the full-screen car detail on phones (2b, `page`). */
@Component({
  selector: 'app-car-panel',
  imports: [Photo, ChevronLeft, SellDialog],
  host: { class: 'g-panel', '[class.page]': 'page()' },
  template: `
    @let c = item().car;
    <div class="g-panel-scroll">
      <div #hdr class="red-head g-panel-head">
        <div class="kicker">
          @if (page()) {
            <button class="btn btn-icon g-back" aria-label="Back" (click)="nav.now('/garage')"><app-chevron-left /></button>
          }
          <span style="font-weight: 800">{{ c.tier }}</span>
          <span>{{ serial(item().serial) }}</span>
          <span style="margin-left: auto">{{ c.year }} · {{ page() ? c.cc : c.country }}</span>
        </div>
        <span class="mk">{{ makeGen(c) }}</span>
        <span #title class="model">{{ c.model }}</span>
      </div>
      <div #photo>
        <app-photo [car]="c" label="car photo · side profile" class="g-panel-photo" />
        @if (c.photoCredit) { <span class="photo-credit">Photo: {{ c.photoCredit }}</span> }
      </div>
      <div #stats class="split g-stats">
        @for (s of blocks(); track s.k) {
          <div class="stat">
            <span class="label">{{ s.k }}</span>
            <span class="v">{{ s.v }}<span class="u">{{ s.u }}</span></span>
            <div class="statbar"><div class="statbar-fill" [style.width.%]="s.pct"></div></div>
          </div>
        }
      </div>
      <div #meta class="meta3 hair-b">
        <div><span class="k">Weight</span><span class="v">{{ num(c.kg) }} kg</span></div>
        <div><span class="k">Upgrade</span><span class="v">Lv {{ item().level }} / 5</span></div>
        <div><span class="k">{{ page() ? 'Value' : 'Market value' }}</span><span class="v">{{ cr(c.value) }}</span></div>
      </div>
      <p class="g-blurb">{{ c.blurb }}</p>
    </div>
    <div class="g-actions">
      <button class="btn btn-primary" style="flex: 1" (click)="race()">Race</button>
      <button class="btn btn-secondary" (click)="nav.go('/upgrade/' + item().carId)">Upgrade</button>
      <button class="btn btn-secondary" (click)="selling.set(true)">Sell</button>
    </div>
    @if (selling()) {
      <app-sell-dialog [car]="c" (closed)="selling.set(false)" (done)="nav.go('/market?tab=mine')" />
    }
  `,
})
export class CarPanel {
  readonly item = input.required<GarageItem>()
  readonly page = input(false)
  protected nav = inject(Nav)
  private store = inject(Store)
  protected selling = signal(false)
  protected cr = cr
  protected num = num
  protected serial = serial
  protected makeGen = makeGen

  private hdr = viewChild.required<ElementRef<HTMLElement>>('hdr')
  private title = viewChild.required<ElementRef<HTMLElement>>('title')
  private photo = viewChild.required<ElementRef<HTMLElement>>('photo')
  private stats = viewChild.required<ElementRef<HTMLElement>>('stats')
  private meta = viewChild.required<ElementRef<HTMLElement>>('meta')

  protected blocks = computed(() => {
    const c = this.item().car
    const pct = (p: number) => Math.max(0, Math.min(100, Math.round(p * 100)))
    return [
      { k: 'Power', v: c.hp, u: 'hp', pct: pct(c.hp / 650) },
      { k: 'Torque', v: c.nm, u: 'Nm', pct: pct(c.nm / 660) },
      { k: '0–100', v: c.acc.toFixed(1), u: 's', pct: pct((12 - c.acc) / 9) },
      { k: 'Top speed', v: c.top, u: 'km/h', pct: pct(c.top / 390) },
    ]
  })

  constructor() {
    // The phone detail page animates on arrival; the desktop panel when the player picks a car.
    afterNextRender(() => { if (this.page()) this.animate() })
  }

  /** Header wipe, photo wipe, title rise, stats stagger, bars fill. */
  animate() {
    animatePanel({
      hdr: this.hdr().nativeElement, title: this.title().nativeElement, photo: this.photo().nativeElement,
      stats: this.stats().nativeElement, meta: this.meta().nativeElement,
    })
  }

  protected race() {
    this.store.setRace({ carId: this.item().carId })
    this.nav.go('/race')
  }
}
