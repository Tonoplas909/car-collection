import { Component, input, output } from '@angular/core'
import { cr } from '../../core/format'
import { TIER_BAR, TIER_FG } from '../../core/tiers'
import { Photo } from '../../shared/photo'
import type { GarageItem } from './car-panel'

/** Garage card: tier bar, photo, tier label, model + generation code, make · year · hp. */
@Component({
  selector: 'app-car-card',
  imports: [Photo],
  host: { style: 'display: contents' },
  template: `
    @let c = item().car;
    <button class="g-card clickable" [class.selected]="selected()" (click)="picked.emit()">
      <div class="g-card-bar" [style.background]="TIER_BAR[c.tier]"></div>
      <app-photo [car]="c" class="g-card-photo" />
      <div class="g-card-body">
        <div class="g-card-kicker">
          <span class="g-card-make">{{ c.make }}</span>
          <span [style.color]="TIER_FG[c.tier]" style="font-weight: 600">{{ c.tier }}</span>
        </div>
        <span class="g-card-model">{{ c.model }}@if (c.gen) {<span class="gen">{{ c.gen }}</span>}</span>
        <span class="g-card-meta tnum">{{ c.year }} · {{ c.hp }} hp{{ compact() ? '' : ' · ' + cr(c.value) }}</span>
      </div>
    </button>
  `,
})
export class CarCard {
  readonly item = input.required<GarageItem>()
  readonly selected = input(false)
  readonly compact = input(false)
  readonly picked = output()
  protected cr = cr
  protected TIER_BAR = TIER_BAR
  protected TIER_FG = TIER_FG
}
