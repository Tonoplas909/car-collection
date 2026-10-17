import { Component, computed, inject, signal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { RACE_EVENTS_BY_ID } from '@game'
import { cr, num, seconds } from '../../core/format'
import { errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { Nav, Viewport } from '../../core/ui'

/** Race results (5c desktop, 6i mobile): place in huge type, red when P1. */
@Component({
  selector: 'app-race-results',
  imports: [RouterLink],
  templateUrl: './race-results.html',
})
export class RaceResults {
  private store = inject(Store)
  protected vp = inject(Viewport)
  private nav = inject(Nav)
  protected cr = cr
  protected seconds = seconds
  protected round = Math.round
  protected busy = signal(false)
  protected error = signal('')

  protected r = this.store.raceResult()
  protected ev = this.r ? RACE_EVENTS_BY_ID[this.r.eventId] : null
  protected won = this.r?.place === 1
  protected best = this.r?.rows[0].time ?? 0
  protected headline = this.won ? 'You won.' : this.r?.place === 2 ? 'So close.' : 'Not this time.'
  protected lenStr = this.ev ? `${num(this.ev.len)} m` : ''
  protected shiftsList: string[] = this.r?.shifts.length ? this.r.shifts : ['—']
  protected perfect = this.r?.shifts.filter(q => q === 'Perfect').length ?? 0
  protected rewards: [string, string][] = this.r ? [['Season points', `+${this.r.rewards.points}`], ['Credits', `+${cr(this.r.rewards.credits)}`], ['XP', `+${this.r.rewards.xp}`]] : []
  protected heroBg = this.won ? 'var(--color-accent)' : 'var(--color-text)'
  protected creditsShort = computed(() => { const c = this.r?.rewards.credits ?? 0; return c >= 1000 ? `${(c / 1000).toFixed(1)}k` : String(c) })

  constructor() {
    if (!this.r) void inject(Router).navigateByUrl('/race', { replaceUrl: true })
  }

  protected gap(i: number, time: number) {
    return i ? `+${(time - this.best).toFixed(2)}` : '—'
  }

  protected shiftStyle(q: string) {
    return q === 'Perfect' ? { background: 'var(--color-accent)', color: 'var(--color-bg)' }
      : q === 'Late' ? { background: 'var(--color-text)', color: 'var(--color-bg)' }
      : { background: 'var(--color-neutral-200)', color: 'var(--color-text)' }
  }

  protected async again() {
    if (!this.r) return
    this.busy.set(true)
    this.error.set('')
    try {
      this.store.setRace({ eventId: this.r.eventId, carId: this.r.carId })
      await this.store.enterRace()
      this.nav.go('/race/live')
    } catch (e) {
      this.error.set(errorMessage(e))
    } finally {
      this.busy.set(false)
    }
  }
}
