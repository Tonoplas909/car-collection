import { Component, computed, effect, inject, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import type { Leaderboard, LeaderboardMetric, LeaderboardScope } from '@api'
import { compact, num, pad2, remaining } from '../../core/format'
import { Store } from '../../core/store'
import { Viewport, clockSignal } from '../../core/ui'

const METRICS: Record<LeaderboardMetric, { label: string; short: string; unit: string }> = {
  race: { label: 'Race points', short: 'Race points', unit: 'pts' },
  value: { label: 'Garage value', short: 'Value', unit: 'CR' },
  size: { label: 'Cars owned', short: 'Cars', unit: 'cars' },
}
const SCOPES: Record<LeaderboardScope, string> = { global: 'Global', friends: 'Friends', region: 'Region' }

/** Leaderboard (4a desktop, 6c mobile): tabs, scope switch, podium, list, pinned "you" row. */
@Component({
  selector: 'app-leaderboard',
  host: { class: 'screen' },
  imports: [RouterLink],
  templateUrl: './leaderboard.html',
})
export class LeaderboardPage {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected now = clockSignal(60_000)
  protected num = num
  protected pad2 = pad2
  protected remaining = remaining
  protected readonly metrics = Object.keys(METRICS) as LeaderboardMetric[]
  protected readonly scopes = Object.keys(SCOPES) as LeaderboardScope[]
  protected readonly M = METRICS
  protected readonly rewards: [string, string][] = [['Top 10', 'Legendary pack + title'], ['Top 1%', 'Apex pack'], ['Top 5%', '2 Heritage packs'], ['Top 25%', '10,000 CR']]

  protected metric = signal<LeaderboardMetric>('race')
  protected scope = signal<LeaderboardScope>('global')
  protected board = signal<Leaderboard | null>(null)
  protected snap = computed(() => this.store.snap())
  protected scopeLabel = (s: LeaderboardScope) => (s === 'region' ? this.snap().user.region || SCOPES.region : SCOPES[s])

  constructor() {
    // Reload when the metric, the scope or the player's data changes.
    effect(onCleanup => {
      const m = this.metric(), s = this.scope()
      this.snap()
      let live = true
      onCleanup(() => { live = false })
      this.store.leaderboard(m, s).then(b => { if (live) this.board.set(b) }, () => {})
    })
  }

  protected score(n: number) {
    return `${num(n)} ${METRICS[this.metric()].unit}`
  }
  protected short(n: number) {
    return this.metric() === 'value' ? compact(n) : num(n)
  }
  protected nextUp = computed(() => {
    const me = this.board()?.me
    if (!me) return ''
    const m = this.metric()
    const gap = m === 'value' ? `${num(me.gapToNext)} CR` : `${num(me.gapToNext)} ${m === 'size' ? (me.gapToNext === 1 ? 'car' : 'cars') : 'pts'}`
    return `${gap} to pass ${me.rank > 1 ? '#' + num(me.rank - 1) : 'the leader'}`
  })
}
