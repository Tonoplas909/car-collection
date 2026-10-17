import { Component, computed, inject, input, output, signal } from '@angular/core'
import { CARS_BY_ID, carLabel } from '@game'
import { cr, num } from '../../core/format'
import { errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { Nav } from '../../core/ui'
import { ConfirmDialog } from '../../shared/confirm-dialog'
import { SellDialog } from '../sell-dialog'
import type { DialogState } from './market-data'

/** Buy / offer / trade / swap / sell confirmations (States 9e). */
@Component({
  selector: 'app-market-dialogs',
  imports: [ConfirmDialog, SellDialog],
  template: `
    @let s = state();
    @if (s?.kind === 'sell') {
      <app-sell-dialog [car]="s.car" (closed)="closed.emit()" (done)="nav.go('/market?tab=mine')" />
    } @else if (s?.kind === 'buy') {
      <app-confirm-dialog kind="Confirm purchase" [title]="'Buy ' + label(s.row.car) + '?'" [rows]="buyRows()"
        [note]="buyShort() ? 'Your balance is too low. Top up ' + num(topUpAmount()) + ' credits to continue.' : 'The car arrives in your garage at its current upgrade level.'"
        [error]="error()" [okLabel]="buyShort() ? 'Top up credits' : 'Buy car'" [busy]="busy()" (cancel)="closed.emit()" (ok)="buy()" />
    } @else if (s?.kind === 'offer') {
      <app-confirm-dialog kind="Make an offer" [title]="'Offer on ' + label(s.row.car)" [rows]="offerRows()"
        note="The seller has 24 hours to accept. Credits are only taken if they do." [error]="error()"
        okLabel="Send offer" [busy]="busy()" (cancel)="closed.emit()" (ok)="offer()">
        <div class="field" style="padding-bottom: 8px">
          <label for="offer-amount">Your offer (CR)</label>
          <input id="offer-amount" class="input tnum" inputmode="numeric" [placeholder]="defaultOffer()" [value]="amount()" (input)="digits($event, amount)" />
        </div>
      </app-confirm-dialog>
    } @else if (s?.kind === 'trade') {
      @if (giveCar(); as g) {
        <app-confirm-dialog kind="Confirm swap" [title]="'Swap ' + label(g) + ' for ' + label(s.row.car) + '?'" [rows]="tradeRows()"
          note="Both players must accept. The offer expires in 24 hours." [error]="error()"
          okLabel="Send offer" [busy]="busy()" (cancel)="closed.emit()" (ok)="trade()">
          <div class="m-dlg-fields">
            <div class="field">
              <label for="swap-give">You give</label>
              <select id="swap-give" class="input" (change)="give.set($any($event.target).value)">
                @for (c of mine(); track c.id) { <option [value]="c.id" [selected]="c.id === g.id">{{ c.make }} {{ label(c) }} · {{ c.tier }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="swap-add">Add credits</label>
              <input id="swap-add" class="input tnum" inputmode="numeric" placeholder="0" [value]="amount()" (input)="digits($event, amount)" />
            </div>
          </div>
        </app-confirm-dialog>
      } @else {
        <app-confirm-dialog kind="Offer a trade" title="No cars to trade." note="Open a pack or win a race first." okLabel="Close" (ok)="closed.emit()" (cancel)="closed.emit()" />
      }
    } @else if (s?.kind === 'swap') {
      <app-confirm-dialog kind="Confirm swap" [title]="'Swap ' + label(cars[s.offer.give]) + ' for ' + label(cars[s.offer.get]) + '?'" [rows]="swapRows()"
        note="Both players must accept. The offer expires in 24 hours." [error]="error()"
        okLabel="Accept swap" [busy]="busy()" (cancel)="closed.emit()" (ok)="accept()" />
    }
  `,
})
export class MarketDialogs {
  readonly state = input<DialogState>(null)
  readonly closed = output()
  private store = inject(Store)
  protected nav = inject(Nav)
  protected cars = CARS_BY_ID
  protected label = carLabel
  protected num = num
  protected busy = signal(false)
  protected error = signal('')
  protected amount = signal('')
  protected give = signal('')

  private row = computed(() => { const s = this.state(); return s && 'row' in s ? s.row : null })
  private credits = computed(() => this.store.credits())

  protected buyShort = computed(() => (this.row()?.price ?? 0) > this.credits())
  protected topUpAmount = computed(() => Math.ceil(((this.row()?.price ?? 0) - this.credits()) / 1000) * 1000)
  protected buyRows = computed<[string, string][]>(() => {
    const r = this.row()
    if (!r) return []
    const after = this.credits() - r.price
    return [['Seller', r.seller], ['Price', cr(r.price)], ['Market fee', '0 CR'], ['Balance after', `${after < 0 ? '−' : ''}${cr(Math.abs(after))}`]]
  })

  protected defaultOffer = computed(() => String(Math.round((this.row()?.price ?? 0) * 0.95)))
  private offerValue = computed(() => Math.round(Number(this.amount() || this.defaultOffer())))
  protected offerRows = computed<[string, string][]>(() => {
    const r = this.row()
    return r ? [['Asking price', cr(r.price)], ['Your offer', cr(this.offerValue())], ['Seller', r.seller]] : []
  })

  protected mine = computed(() => this.store.snap().garage.map(g => CARS_BY_ID[g.carId]).filter(Boolean).sort((a, b) => b.value - a.value))
  protected giveCar = computed(() => CARS_BY_ID[this.give() || this.mine()[0]?.id])
  private added = computed(() => Math.round(Number(this.amount()) || 0))
  protected tradeRows = computed<[string, string][]>(() => {
    const r = this.row(), g = this.giveCar()
    return r && g ? [['You give', `${carLabel(g)} · ${g.tier}`], ['You get', `${carLabel(r.car)} · ${r.car.tier}`], ['Added credits', `+${cr(this.added())}`], ['Partner', r.seller]] : []
  })

  protected swapRows = computed<[string, string][]>(() => {
    const s = this.state()
    if (s?.kind !== 'swap') return []
    const a = CARS_BY_ID[s.offer.give], b = CARS_BY_ID[s.offer.get]
    return [['You give', `${carLabel(a)} · ${a.tier}`], ['You get', `${carLabel(b)} · ${b.tier}`], ['Added credits', `+${cr(s.offer.credits)}`], ['Partner', s.offer.from]]
  })

  protected digits(e: Event, target: ReturnType<typeof signal<string>>) {
    const el = e.target as HTMLInputElement
    el.value = el.value.replace(/[^\d]/g, '')
    target.set(el.value)
  }

  private async run(fn: () => Promise<unknown>) {
    this.busy.set(true)
    this.error.set('')
    try { await fn(); this.closed.emit() } catch (e) { this.error.set(errorMessage(e)) } finally { this.busy.set(false) }
  }

  protected buy() {
    const r = this.row()!
    if (this.buyShort()) { this.closed.emit(); this.nav.go('/credits'); return }
    void this.run(() => this.store.buyListing(r.id))
  }
  protected offer() { const r = this.row()!; void this.run(() => this.store.makeOffer(r.id, this.offerValue())) }
  protected trade() {
    const r = this.row()!, g = this.giveCar()!
    void this.run(() => this.store.proposeSwap({ to: r.seller, give: g.id, get: r.carId, credits: this.added() }))
  }
  protected accept() {
    const s = this.state()
    if (s?.kind === 'swap') void this.run(() => this.store.acceptSwap(s.offer.id))
  }
}
