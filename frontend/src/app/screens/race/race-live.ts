import { NgTemplateOutlet } from '@angular/common'
import { Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import type { RaceResult } from '@api'
import { CARS_BY_ID, DT, GEARS, RACE_EVENTS_BY_ID, RaceSim, SHIFT_WINDOW, calibrateOpponents, type ShiftQuality } from '@game'
import { seconds } from '../../core/format'
import { errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { TIER_BAR } from '../../core/tiers'
import { Nav, Viewport } from '../../core/ui'

type Phase = 'idle' | 'count' | 'race' | 'submitting' | 'done'

interface Overlay { big: string; sub: string; fg: string; btn?: string; act?: () => void }

/**
 * Live race (5b desktop, 6f mobile): the shared fixed-step RaceSim runs in requestAnimationFrame,
 * the player shifts with the button or the space bar, and the server replays the shift steps to score it.
 */
@Component({
  selector: 'app-race-live',
  host: { '(window:keydown.space)': 'onSpace($event)' },
  imports: [NgTemplateOutlet],
  templateUrl: './race-live.html',
})
export class RaceLive {
  private store = inject(Store)
  protected vp = inject(Viewport)
  private nav = inject(Nav)
  protected readonly GEARS = GEARS
  protected readonly W = SHIFT_WINDOW
  protected seconds = seconds
  protected round = Math.round

  // Hold the entry this screen started with: finishing the race clears it from the store.
  protected entry = this.store.raceEntry()
  protected car = this.entry ? CARS_BY_ID[this.entry.carId] : null
  protected ev = this.entry ? RACE_EVENTS_BY_ID[this.entry.eventId] : null
  private level = this.entry ? (this.store.snapshot()?.garage.find(g => g.carId === this.entry!.carId)?.level ?? 0) : 0
  private spec = this.car ? { hp: this.car.hp, kg: this.car.kg, top: this.car.top, level: this.level } : null
  private opps = this.spec && this.ev && this.entry
    ? calibrateOpponents(this.spec, this.ev.len).map((o, i) => ({ ...o, name: this.entry!.opponents[i]?.name ?? o.name, car: this.entry!.opponents[i]?.car ?? o.car }))
    : []
  private sim = this.spec && this.ev ? new RaceSim(this.spec, this.ev.len) : null
  private shifts: number[] = []
  private raf = 0

  protected phase = signal<Phase>('idle')
  protected count = signal(3)
  protected view = signal({ t: 0, d: 0, v: 0, gear: 1, rpm: 0, quality: null as ShiftQuality | null })
  protected result = signal<RaceResult | null>(null)
  protected error = signal('')

  protected ticks = this.ev ? Array.from({ length: Math.ceil(this.ev.len / 100) - 1 }, (_, i) => (((i + 1) * 100) / this.ev!.len) * 100) : []

  protected lanes = computed(() => {
    const v = this.view(), p = this.phase()
    const tNow = p === 'race' || p === 'submitting' || p === 'done' ? v.t : 0
    return [
      { name: 'You', car: `${this.car!.make} ${this.car!.model}`, d: v.d, me: true, bar: TIER_BAR[this.car!.tier] },
      ...this.opps.map(o => ({ name: o.name, car: o.car, d: o.distanceAt(tNow), me: false, bar: 'var(--color-neutral-500)' })),
    ].map(l => ({ ...l, p: Math.min(100, (l.d / this.ev!.len) * 100) }))
  })
  private pos = computed(() => [...this.lanes()].sort((a, b) => b.d - a.d).findIndex(l => l.me) + 1)
  protected hud = computed(() => {
    const p = this.phase(), racing = p === 'race' || p === 'submitting' || p === 'done'
    return {
      pos: p === 'idle' || p === 'count' ? '—' : `${this.result()?.place ?? this.pos()} / 4`,
      time: seconds(racing ? this.view().t : 0),
      togo: `${Math.max(0, Math.round(this.ev!.len - this.view().d))} m`,
    }
  })
  protected rpmBg = computed(() => {
    const r = this.view().rpm
    return r >= SHIFT_WINDOW.perfect ? 'var(--color-accent)' : r >= SHIFT_WINDOW.start ? 'var(--color-accent-600)' : 'var(--color-text)'
  })
  protected overlay = computed<Overlay | null>(() => {
    const p = this.phase(), r = this.result()
    if (p === 'idle') return { big: 'Ready', sub: 'Three opponents found. Press start, then shift up in the window.', fg: 'var(--color-text)', btn: 'Start race', act: () => this.start() }
    if (p === 'count') return { big: String(this.count()), sub: 'Get ready', fg: 'var(--color-text)' }
    if (p === 'submitting') return { big: '…', sub: 'Checking times', fg: 'var(--color-text)' }
    if (p === 'done') {
      return r
        ? { big: `P${r.place}`, sub: `${seconds(r.time)} · ${r.place === 1 ? 'you won' : 'race over'}`, fg: r.place === 1 ? 'var(--color-accent)' : 'var(--color-text)', btn: 'See results', act: () => this.nav.go('/race/results') }
        : { big: '!', sub: this.error() || 'The result could not be saved.', fg: 'var(--color-accent)', btn: 'Back to race setup', act: () => this.nav.go('/race') }
    }
    return null
  })
  protected mobileBtn = computed(() => {
    const o = this.overlay()
    if (this.phase() === 'race') return { label: 'Shift up', act: () => this.shift() }
    if (o?.btn) return { label: o.btn, act: o.act! }
    return { label: o?.big ?? '', act: () => {} }
  })

  constructor() {
    if (!this.entry || !this.car || !this.ev) void inject(Router).navigateByUrl('/race', { replaceUrl: true })
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf))
  }

  private async finish() {
    this.phase.set('submitting')
    try {
      this.result.set(await this.store.finishRace(this.shifts))
    } catch (e) {
      this.error.set(errorMessage(e))
    }
    this.phase.set('done')
  }

  start() {
    cancelAnimationFrame(this.raf)
    this.phase.set('count')
    let last = performance.now(), cd = 3, acc = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (this.phase() === 'count') {
        cd -= dt
        if (cd <= 0) this.phase.set('race')
        else this.count.set(Math.ceil(cd))
      } else if (this.phase() === 'race') {
        acc += dt
        const s = this.sim!
        while (acc >= DT && !s.s.finished) { s.step(); acc -= DT }
        this.view.update(v => ({ ...v, t: s.s.t, d: Math.min(this.ev!.len, s.s.d), v: s.s.v, gear: s.s.gear, rpm: s.s.rpm }))
        if (s.s.finished) { void this.finish(); return }
      }
      if (this.phase() === 'count' || this.phase() === 'race') this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  shift() {
    if (this.phase() !== 'race') return
    const s = this.sim!
    const step = s.s.step
    const q = s.shift()
    if (!q) return
    this.shifts.push(step)
    this.view.update(v => ({ ...v, gear: s.s.gear, rpm: s.s.rpm, quality: q }))
  }

  protected onSpace(e: Event) {
    if (this.phase() !== 'race') return
    e.preventDefault()
    this.shift()
  }
}
