import { Component, computed, inject, signal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { CARS_BY_ID, PACKS_BY_ID, makeGen } from '@game'
import { cr, num, pad2 } from '../../core/format'
import { Store } from '../../core/store'
import { TIER_BAR } from '../../core/tiers'
import { Viewport } from '../../core/ui'
import { Photo } from '../../shared/photo'
import { LowCredits } from './low-credits'
import { OpenPack } from './open-pack'

const CLOSED = [false, false, false, false, false]

/** Pack reveal (3b desktop, 6h mobile): five face-down cards; each cover rolls up like a garage door. */
@Component({
  selector: 'app-pack-reveal',
  imports: [RouterLink, Photo, LowCredits],
  providers: [OpenPack],
  templateUrl: './pack-reveal.html',
})
export class PackReveal {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected op = inject(OpenPack)
  protected cr = cr
  protected num = num
  protected pad2 = pad2
  protected makeGen = makeGen
  protected TIER_BAR = TIER_BAR
  protected cars = CARS_BY_ID

  protected open = signal<boolean[]>(CLOSED)
  protected stagger = signal<number[]>([])
  protected round = signal(0)

  protected opening = computed(() => this.store.opening())
  protected pack = computed(() => { const o = this.opening(); return !o || o.packId === 'free' ? PACKS_BY_ID.street : PACKS_BY_ID[o.packId] })
  protected title = computed(() => (this.opening()?.packId === 'free' ? 'free Street' : this.pack().name))
  protected revealed = computed(() => this.open().filter(Boolean).length)
  protected done = computed(() => this.open().every(Boolean))
  protected newCount = computed(() => this.opening()?.pulls.filter(p => !p.duplicate).length ?? 0)
  protected pulls = computed(() => (this.opening()?.pulls ?? []).map(p => ({ ...p, car: CARS_BY_ID[p.carId] })))

  constructor() {
    if (!this.store.opening()) void inject(Router).navigateByUrl('/packs', { replaceUrl: true })
  }

  protected flip(i: number) {
    this.stagger.set([])
    this.open.update(o => o.map((x, k) => (k === i ? true : x)))
  }

  protected revealAll() {
    let k = 0
    this.stagger.set(this.open().map(o => (o ? 0 : (k++) * 260)))
    this.open.set(this.open().map(() => true))
  }

  protected async another() {
    if (!(await this.op.open(this.pack().id, true))) return
    this.open.set(CLOSED)
    this.stagger.set([])
    this.round.update(r => r + 1)
  }

  protected delay(i: number, extra = 0) {
    return this.open()[i] ? `${(this.stagger()[i] ?? 0) + extra}ms` : '0ms'
  }
}
