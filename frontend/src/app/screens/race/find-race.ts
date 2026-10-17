import { Injectable, inject, signal } from '@angular/core'
import { RACE_EVENTS_BY_ID, type RaceEvent } from '@game'
import { GameError, errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { Nav } from '../../core/ui'

/** Enter the selected race (charges the entry fee) and go to the live screen. */
@Injectable()
export class FindRace {
  private store = inject(Store)
  private nav = inject(Nav)
  readonly phase = signal<'idle' | 'searching' | 'timeout'>('idle')
  readonly short = signal<RaceEvent | null>(null)
  readonly error = signal('')

  async find() {
    this.error.set('')
    this.phase.set('searching')
    // Matchmaking: opponents are found after a short search. Offline players time out (9c).
    await new Promise(r => setTimeout(r, 900))
    if (!navigator.onLine) { this.phase.set('timeout'); return }
    try {
      await this.store.enterRace()
      this.nav.go('/race/live')
    } catch (e) {
      this.phase.set('idle')
      if (e instanceof GameError && e.code === 'insufficient_credits') this.short.set(RACE_EVENTS_BY_ID[this.store.race().eventId])
      else this.error.set(errorMessage(e))
    }
  }

  retry() {
    this.phase.set('idle')
    void this.find()
  }

  topUp() {
    this.short.set(null)
    this.nav.go('/credits')
  }
}
