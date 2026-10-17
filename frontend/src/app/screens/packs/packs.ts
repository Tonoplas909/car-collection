import { Component, computed, inject } from '@angular/core'
import { DUPLICATE_CREDITS, PACKS, PITY_LIMIT, TIERS } from '@game'
import { clock, cr } from '../../core/format'
import { Store } from '../../core/store'
import { Viewport, clockSignal } from '../../core/ui'
import { MobileHead } from '../../shared/mobile-head'
import { Photo } from '../../shared/photo'
import { LowCredits } from './low-credits'
import { OpenPack } from './open-pack'

const pct = (p: number) => `${Math.round(p * 100)}%`
const TIER_NAMES = ['Common', 'Rare', 'Epic', 'Legendary']

/** Pack shop (3a desktop, 6a mobile). */
@Component({
  selector: 'app-packs',
  host: { class: 'screen' },
  imports: [MobileHead, Photo, LowCredits],
  providers: [OpenPack],
  templateUrl: './packs.html',
})
export class Packs {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected op = inject(OpenPack)
  protected now = clockSignal()
  protected cr = cr
  protected clock = clock
  protected pct = pct
  protected readonly packs = PACKS
  protected readonly tiers = TIERS
  protected readonly dupes = DUPLICATE_CREDITS
  protected readonly pityLimit = PITY_LIMIT
  protected readonly oddsLabels = ['Common', 'Rare', 'Epic', 'Legend']
  protected readonly pitySlots = Array.from({ length: PITY_LIMIT }, (_, i) => i)

  protected snap = computed(() => this.store.snap())
  protected freeReady = computed(() => this.snap().freePackAt <= this.now())
  protected pityLeft = computed(() => PITY_LIMIT - this.snap().stats.pity)
  protected mobileOdds = (odds: number[]) => odds.map((o, i) => (o ? `${TIER_NAMES[i]} ${pct(o)}` : '')).filter(Boolean).join(' · ')
}
