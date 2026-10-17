import { Component, computed, inject } from '@angular/core'
import { cr, num } from '../../core/format'
import { ConfirmDialog } from '../../shared/confirm-dialog'
import { OpenPack } from './open-pack'

@Component({
  selector: 'app-low-credits',
  imports: [ConfirmDialog],
  template: `
    @if (op.short(); as s) {
      <app-confirm-dialog kind="Low credits" [title]="'You need ' + cr(s.pack.price) + '.'" [rows]="rows()"
        [note]="'The ' + s.pack.name + ' pack costs ' + num(s.pack.price) + ' credits. Win races or top up.'"
        okLabel="Top up credits" (ok)="op.topUp()" (cancel)="op.short.set(null)" />
    }
  `,
})
export class LowCredits {
  protected op = inject(OpenPack)
  protected cr = cr
  protected num = num
  protected rows = computed<[string, string][]>(() => {
    const s = this.op.short()
    return s ? [['Pack', `${s.pack.name} · ${cr(s.pack.price)}`], ['Your balance', cr(s.have)], ['Missing', cr(s.pack.price - s.have)]] : []
  })
}
