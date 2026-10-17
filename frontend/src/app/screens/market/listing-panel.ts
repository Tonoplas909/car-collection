import { Component, ElementRef, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core'
import { makeGen } from '@game'
import { cr, remaining } from '../../core/format'
import { animatePanel } from '../../core/motion'
import { Store } from '../../core/store'
import { Nav } from '../../core/ui'
import { ChevronLeft } from '../../shared/icons'
import { Photo } from '../../shared/photo'
import { delta, deltaStr, history, type Row } from './market-data'

/** Market detail panel (3c), or the full-screen listing on phones (`page`). */
@Component({
  selector: 'app-listing-panel',
  imports: [Photo, ChevronLeft],
  host: { class: 'mk-panel', '[class.page]': 'page()' },
  template: `
    @let r = row();
    <div class="mk-panel-scroll">
      <div #hdr class="red-head">
        <div class="kicker">
          @if (page()) { <button class="btn btn-icon g-back" aria-label="Back" (click)="nav.now('/market')"><app-chevron-left /></button> }
          <span style="font-weight: 800">{{ r.car.tier }}</span>
          <span>Lv {{ r.level }}</span>
          <span style="margin-left: auto">{{ r.car.year }}</span>
        </div>
        <span class="mk">{{ makeGen(r.car) }}</span>
        <span #title class="model" [style.font-size.px]="page() ? 36 : 40">{{ r.car.model }}</span>
      </div>
      <div #photo>
        <app-photo [car]="r.car" label="car photo · side profile" class="mk-photo" />
        @if (r.car.photoCredit) { <span class="photo-credit">Photo: {{ r.car.photoCredit }}</span> }
      </div>
      <div #price class="split mk-prices">
        <div><span class="label">Buy now</span><span class="mk-big tnum">{{ cr(r.price) }}</span></div>
        <div><span class="label">vs. 30-day avg</span><span class="mk-big tnum" [style.color]="d() > 0 ? 'var(--color-accent-700)' : 'var(--color-text)'">{{ deltaStr(d()) }}</span></div>
      </div>
      <div class="mk-hist-wrap hair-b">
        <div class="label" style="display: flex">
          <span>Sale price, last 12 weeks</span>
          <span style="margin-left: auto">avg {{ cr(r.avg) }}</span>
        </div>
        <div #histBars class="mk-hist">
          @for (v of hist(); track $index) {
            <span [style.height.%]="pct(v)" [style.background]="$index === 11 ? 'var(--color-accent)' : 'var(--color-neutral-500)'" [title]="cr(v)"></span>
          }
        </div>
      </div>
      <div #meta class="meta3">
        <div><span class="k">Seller</span><span class="v">{{ r.seller }}</span></div>
        <div><span class="k">Ends in</span><span class="v">{{ remaining(r.endsAt - now()) }}</span></div>
        <div><span class="k">In your garage</span><span class="v">{{ owned() ? 'Yes · Lv ' + owned()!.level : 'No' }}</span></div>
      </div>
    </div>
    <div class="mk-actions">
      <button class="btn btn-primary btn-md" (click)="buy.emit()" [disabled]="!!owned()">{{ owned() ? 'Already in your garage' : 'Buy for ' + cr(r.price) }}</button>
      <div class="mk-actions-2">
        <button class="btn btn-secondary btn-md" (click)="offer.emit()" [disabled]="!!owned()">Make an offer</button>
        <button class="btn btn-secondary btn-md" (click)="trade.emit()">Offer a trade</button>
      </div>
    </div>
  `,
})
export class ListingPanel {
  readonly row = input.required<Row>()
  readonly now = input.required<number>()
  readonly page = input(false)
  readonly buy = output()
  readonly offer = output()
  readonly trade = output()
  protected nav = inject(Nav)
  private store = inject(Store)
  protected cr = cr
  protected remaining = remaining
  protected makeGen = makeGen
  protected deltaStr = deltaStr

  protected hist = computed(() => history(this.row()))
  private max = computed(() => Math.max(...this.hist()))
  protected pct = (v: number) => Math.round((v / this.max()) * 100)
  protected d = computed(() => delta(this.row()))
  protected owned = computed(() => this.store.snap().garage.find(g => g.carId === this.row().carId))

  private hdr = viewChild.required<ElementRef<HTMLElement>>('hdr')
  private title = viewChild.required<ElementRef<HTMLElement>>('title')
  private photo = viewChild.required<ElementRef<HTMLElement>>('photo')
  private price = viewChild.required<ElementRef<HTMLElement>>('price')
  private histEl = viewChild.required<ElementRef<HTMLElement>>('histBars')
  private meta = viewChild.required<ElementRef<HTMLElement>>('meta')

  constructor() {
    afterNextRender(() => { if (this.page()) this.animate() })
  }

  animate() {
    animatePanel({
      hdr: this.hdr().nativeElement, title: this.title().nativeElement, photo: this.photo().nativeElement,
      stats: this.price().nativeElement, hist: this.histEl().nativeElement, meta: this.meta().nativeElement,
    })
  }
}
