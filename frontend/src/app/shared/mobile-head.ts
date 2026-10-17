import { Component, inject, input } from '@angular/core'
import { Store } from '../core/store'
import { num } from '../core/format'

/** Phone header: big title on the left, credits (or projected content) on the right. */
@Component({
  selector: 'app-mobile-head',
  host: { class: 'm-head' },
  template: `
    <span class="m-title"><ng-content select="[title]" />{{ title() }}</span>
    @if (custom()) { <ng-content /> } @else { <span class="m-credits">{{ num(store.credits()) }} CR</span> }
  `,
})
export class MobileHead {
  readonly title = input('')
  /** true: project the right-hand side instead of the credits */
  readonly custom = input(false)
  protected store = inject(Store)
  protected num = num
}
