import { Component, computed, inject, input, output, signal } from '@angular/core'
import { carLabel, marketFee, type Car } from '@game'
import { cr } from '../core/format'
import { errorMessage } from '../core/game-error'
import { Store } from '../core/store'
import { ConfirmDialog } from '../shared/confirm-dialog'

/** List a car on the market (from the garage panel or the market's Sell tab). */
@Component({
  selector: 'app-sell-dialog',
  imports: [ConfirmDialog],
  template: `
    <app-confirm-dialog kind="Confirm listing" [title]="'List ' + label() + ' for ' + cr(p()) + '?'" [rows]="rows()"
      note="The car leaves your garage while it is listed. You can cancel any time." [error]="error()"
      okLabel="List car" [busy]="busy()" (ok)="submit()" (cancel)="closed.emit()">
      <div class="field" style="padding-bottom: 8px">
        <label for="sell-price">Price (CR)</label>
        <input id="sell-price" class="input tnum" inputmode="numeric" [value]="price()" (input)="onInput($event)" />
      </div>
    </app-confirm-dialog>
  `,
})
export class SellDialog {
  readonly car = input.required<Car>()
  readonly closed = output()
  readonly done = output()
  private store = inject(Store)
  protected cr = cr
  protected price = signal('')
  protected busy = signal(false)
  protected error = signal('')
  protected label = computed(() => carLabel(this.car()))
  protected p = computed(() => Math.max(0, Math.round(Number(this.price()) || 0)))
  protected rows = computed<[string, string][]>(() => {
    const p = this.p()
    return [['Last sale', cr(this.car().value)], ['Your price', cr(p)], ['Market fee 5%', cr(marketFee(p))], ['You receive', cr(p - marketFee(p))]]
  })

  ngOnInit() {
    this.price.set(String(Math.round((this.car().value * 1.04) / 100) * 100))
  }

  protected onInput(e: Event) {
    const el = e.target as HTMLInputElement
    el.value = el.value.replace(/[^\d]/g, '')
    this.price.set(el.value)
  }

  protected async submit() {
    this.busy.set(true)
    this.error.set('')
    try {
      await this.store.listCar(this.car().id, this.p())
      this.closed.emit()
      this.done.emit()
    } catch (e) {
      this.error.set(errorMessage(e))
    } finally {
      this.busy.set(false)
    }
  }
}
