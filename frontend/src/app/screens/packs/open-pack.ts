import { Injectable, inject, signal } from '@angular/core'
import { PACKS_BY_ID, type PackDef, type PackId } from '@game'
import { GameError, errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { Nav } from '../../core/ui'

/** Opens a pack (or explains the shortfall) and moves to the reveal. One instance per screen. */
@Injectable()
export class OpenPack {
  private store = inject(Store)
  private nav = inject(Nav)
  readonly busy = signal<PackId | 'free' | null>(null)
  readonly short = signal<{ pack: PackDef; have: number } | null>(null)
  readonly error = signal('')

  /** `stay`: already on the reveal screen, so just swap in the new opening. */
  async open(id: PackId | 'free', stay = false) {
    if (this.busy()) return false
    const credits = this.store.credits()
    if (id !== 'free' && credits < PACKS_BY_ID[id].price) { this.short.set({ pack: PACKS_BY_ID[id], have: credits }); return false }
    this.busy.set(id)
    this.error.set('')
    try {
      if (id === 'free') await this.store.claimFreePack()
      else await this.store.openPack(id)
      if (!stay) this.nav.go('/packs/open')
      return true
    } catch (e) {
      if (e instanceof GameError && e.code === 'insufficient_credits' && id !== 'free') this.short.set({ pack: PACKS_BY_ID[id], have: credits })
      else this.error.set(errorMessage(e))
      return false
    } finally {
      this.busy.set(null)
    }
  }

  topUp() {
    this.short.set(null)
    this.nav.go('/credits')
  }
}
