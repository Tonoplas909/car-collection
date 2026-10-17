import { Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { CARS_BY_ID, CATALOG, carLabel, type Car } from '@game'
import { EASE, OUT, reduced } from '../../core/motion'
import { Store } from '../../core/store'
import { Photo } from '../../shared/photo'

const TICKER = ['Golf GTI Mk1', 'M3 E30', 'Skyline GT-R R34', 'F40', '911 Carrera RS 2.7', 'Supra A80', 'NSX NA1', 'Countach LP400', 'RX-7 FD', '2000GT', 'McLaren F1', '240Z S30', '300 SL W198', 'Delta HF Integrale', 'AE86', '959']
const years = CATALOG.map(c => c.year)

const KF: Record<string, Keyframe[]> = {
  line: [{ transform: 'translateY(105%)' }, { transform: 'none' }],
  up: [{ transform: 'translateY(28px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  rule: [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
  wipe: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
  sweep: [{ transform: 'scaleX(1)', offset: 0 }, { transform: 'scaleX(1)', offset: 0.45 }, { transform: 'scaleX(0)' }],
}
const DUR: Record<string, number> = { line: 900, up: 700, rule: 1100, wipe: 900, sweep: 1500 }

function countUp(n: HTMLElement) {
  const src = n.dataset['src'] ?? n.textContent ?? ''
  n.dataset['src'] = src
  const nums = src.match(/\d+/g)
  if (!nums) return
  const t0 = performance.now(), dur = 1400
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3)
    let i = 0
    n.textContent = src.replace(/\d+/g, () => {
      const v = +nums[i++]
      const from = v > 1000 ? v - 70 : 0
      return String(Math.round(from + (v - from) * e))
    })
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Landing page (Landing.dc.html, 6g): headline lines rise from masks, hero wipe + red sweep, stats count up, ticker. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, Photo],
  templateUrl: './landing.html',
})
export class Landing {
  protected store = inject(Store)
  protected readonly ticker = [...TICKER, ...TICKER]
  protected readonly count = CATALOG.length
  protected readonly hero = CARS_BY_ID['porsche-911-rs27']
  protected readonly heroLabel = `${this.hero.make} ${carLabel(this.hero)} · ${this.hero.year} · ${this.hero.tier}`
  protected readonly tierCards = ['vw-golf-gti-mk1', 'bmw-m3-e30', 'nissan-skyline-r34', 'mclaren-f1'].map(id => CARS_BY_ID[id])
  protected readonly stats: [string, string][] = [
    [String(CATALOG.length), 'Licensed models'], [`${Math.min(...years)}–${Math.max(...years)}`, 'Decades of cars'], ['4', 'Rarity tiers'], ['90 s', 'Average race'],
  ]
  protected readonly steps = [
    ['01', 'Open packs', 'Five cars per pack, with published odds for every tier. Duplicates convert to credits, and a Legendary is guaranteed at least once every 20 packs.'],
    ['02', 'Race to win cars', 'Short real-time races against other players. Power, torque, weight and upgrades all count. Winning earns season points, and event wins unlock cars you can’t get from packs.'],
    ['03', 'Trade on the market', 'Buy, sell or swap with other collectors. Each listing shows twelve weeks of sale prices, so you know whether that R34 is a deal.'],
  ]
  protected tierBar = (c: Car) => ({ Common: 'var(--color-neutral-400)', Rare: 'var(--color-text)', Epic: 'var(--color-accent-400)', Legendary: 'var(--color-accent-700)' })[c.tier]
  protected tierFg = (c: Car) => ({ Common: 'var(--color-neutral-700)', Rare: 'var(--color-text)', Epic: 'var(--color-accent-700)', Legendary: 'inherit' })[c.tier]

  private root = viewChild.required<ElementRef<HTMLElement>>('root')
  private marquee = viewChild.required<ElementRef<HTMLElement>>('marquee')
  private parallax = viewChild.required<ElementRef<HTMLElement>>('parallax')

  constructor() {
    const destroyRef = inject(DestroyRef)
    afterNextRender(() => {
      const cleanup = this.startMotion()
      destroyRef.onDestroy(cleanup)
    })
  }

  /** Scroll-triggered entrance animations, the ticker and the hero parallax. */
  private startMotion() {
    const el = this.root().nativeElement
    if (reduced()) return () => {}
    const anims = new Map<Element, Animation[]>()
    el.querySelectorAll<HTMLElement>('[data-anim]').forEach(n => {
      const type = n.dataset['anim']!
      const a = n.animate(KF[type], { duration: DUR[type], delay: +(n.dataset['delay'] ?? 0), easing: type === 'sweep' || type === 'wipe' ? EASE : OUT, fill: 'both' })
      a.pause()
      a.currentTime = 0
      const target = type === 'line' || type === 'wipe' || type === 'sweep' ? n.parentElement! : n
      anims.set(target, [...(anims.get(target) ?? []), a])
    })
    const play = (t: Element) => {
      const list = anims.get(t)
      if (!list) return
      anims.delete(t)
      list.forEach(a => a.play())
      t.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp)
      io.unobserve(t)
    }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) play(e.target) }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
    anims.forEach((_, t) => io.observe(t))
    const check = () => {
      const vh = window.innerHeight
      anims.forEach((_, t) => {
        const r = t.getBoundingClientRect()
        if (r.bottom > 0 && r.top < vh * 0.92 && r.height > 0) play(t)
      })
    }
    requestAnimationFrame(check)
    const timer = setTimeout(check, 300)

    const m = this.marquee().nativeElement
    const mq = m.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 60000, iterations: Infinity })
    const slow = () => mq.updatePlaybackRate(0.25), fast = () => mq.updatePlaybackRate(1)
    m.parentElement?.addEventListener('mouseenter', slow)
    m.parentElement?.addEventListener('mouseleave', fast)
    const onScroll = () => {
      this.parallax().nativeElement.style.transform = `translateY(${Math.min(window.scrollY, 800) * 0.06}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      io.disconnect()
      mq.cancel()
      m.parentElement?.removeEventListener('mouseenter', slow)
      m.parentElement?.removeEventListener('mouseleave', fast)
      window.removeEventListener('scroll', onScroll)
      anims.forEach(list => list.forEach(a => a.finish()))
    }
  }
}
