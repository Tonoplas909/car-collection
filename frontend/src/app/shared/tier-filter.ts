import { Component, input, output } from '@angular/core'
import type { Tier } from '@game'

type Option = Tier | 'All'

@Component({
  selector: 'app-tier-filter',
  host: { class: 'tier-filter', role: 'group', 'aria-label': 'Filter by tier' },
  template: `
    @for (t of options; track t) {
      <button type="button" [attr.aria-pressed]="value() === t" (click)="changed.emit(t)">
        @if (counts(); as c) {
          <span class="tf-label">{{ short() && t === 'Legendary' ? 'Legend' : t }}</span>
          <span class="tf-n">{{ c[t] }}</span>
        } @else {
          {{ t }}
        }
      </button>
    }
  `,
})
export class TierFilter {
  readonly value = input.required<Option>()
  readonly counts = input<Record<Option, number>>()
  readonly short = input(false)
  readonly changed = output<Option>()
  protected readonly options: Option[] = ['All', 'Common', 'Rare', 'Epic', 'Legendary']
}
