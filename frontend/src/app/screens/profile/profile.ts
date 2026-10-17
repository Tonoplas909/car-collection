import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { CARS_BY_ID, CATALOG, TIERS, TIER_RANK, XP_PER_LEVEL, makeGen, type Car } from '@game'
import { ago, compact, cr, num } from '../../core/format'
import { Store } from '../../core/store'
import { TIER_BAR } from '../../core/tiers'
import { Viewport } from '../../core/ui'
import { Photo } from '../../shared/photo'

const TIER_TRACK = { ...TIER_BAR, Common: 'var(--color-neutral-500)' }

/** Profile (4b desktop, 6d mobile): level, headline stats, collection by tier and country, showcase, activity. */
@Component({
  selector: 'app-profile',
  host: { class: 'screen' },
  imports: [NgTemplateOutlet, RouterLink, Photo],
  templateUrl: './profile.html',
})
export class Profile {
  protected store = inject(Store)
  protected vp = inject(Viewport)
  protected num = num
  protected ago = ago
  protected makeGen = makeGen
  protected readonly xpPerLevel = XP_PER_LEVEL

  protected snap = computed(() => this.store.snap())
  protected u = computed(() => this.snap().user)
  protected place = computed(() => [this.u().city, this.u().region].filter(Boolean).join(', '))
  protected since = computed(() => new Date(this.u().since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))
  protected xpPct = computed(() => Math.round((this.u().xp / XP_PER_LEVEL) * 100))

  private owned = computed(() => this.snap().garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car))
  protected byTier = computed(() => TIERS.map(t => ({
    k: t, have: this.owned().filter(o => o.car.tier === t).length, total: CATALOG.filter(c => c.tier === t).length, bar: TIER_TRACK[t],
  })))
  protected countries = computed(() => {
    const ids = new Set(this.owned().map(o => o.carId))
    return [...new Set(CATALOG.map(c => c.country))]
      .map(k => ({ k, have: CATALOG.filter(c => c.country === k && ids.has(c.id)).length, total: CATALOG.filter(c => c.country === k).length, bar: 'var(--color-text)' }))
      .sort((a, b) => b.total - a.total)
  })
  protected showcase = computed(() => {
    const list: Car[] = this.owned().filter(o => o.showcase).map(o => o.car)
    for (const o of [...this.owned()].sort((a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.value - a.car.value)) {
      if (list.length >= 3) break
      if (!list.includes(o.car)) list.push(o.car)
    }
    return list
  })
  protected stats = computed(() => {
    const s = this.snap().stats, owned = this.owned()
    const value = owned.reduce((a, o) => a + o.car.value, 0)
    const winRate = s.racesRun ? Math.round((s.racesWon / s.racesRun) * 100) : 0
    return [
      { k: 'Cars owned', v: String(owned.length), sub: `of ${CATALOG.length} in the game` },
      { k: 'Garage value', v: compact(value), sub: 'CR' },
      { k: 'Races won', v: num(s.racesWon), sub: `of ${num(s.racesRun)} · ${winRate}% win rate` },
      { k: 'Race points', v: num(s.seasonPoints), sub: `Season ${this.snap().season}` },
      { k: 'Packs opened', v: num(s.packsOpened), sub: `${s.legendaryPulls} Legendary pulls` },
      { k: 'Market trades', v: num(s.trades), sub: `${s.tradeNet >= 0 ? '+' : '−'}${cr(Math.abs(s.tradeNet))} net` },
      { k: 'Best lap', v: s.bestLap, sub: 'Nürburgring GP' },
      { k: 'Login streak', v: `${s.streak} day${s.streak === 1 ? '' : 's'}`, sub: `Best: ${s.bestStreak} days` },
    ]
  })
  protected mobileStats = computed(() => this.stats().filter((_, i) => [0, 1, 2, 3, 4, 6].includes(i)))
  protected pct = (have: number, total: number) => (total ? Math.round((have / total) * 100) : 0)
}
