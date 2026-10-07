import { useEffect, useRef, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { CATALOG, CARS_BY_ID, carLabel, type Car } from '@game'
import { Photo } from '../components/ui'
import { EASE, OUT, reduced } from '../lib/motion'
import { useApp } from '../state/store'
import './Landing.css'

const TICKER = ['Golf GTI Mk1', 'M3 E30', 'Skyline GT-R R34', 'F40', '911 Carrera RS 2.7', 'Supra A80', 'NSX NA1', 'Countach LP400', 'RX-7 FD', '2000GT', 'McLaren F1', '240Z S30', '300 SL W198', 'Delta HF Integrale', 'AE86', '959']
const TIER_CARDS = ['vw-golf-gti-mk1', 'bmw-m3-e30', 'nissan-skyline-r34', 'mclaren-f1'].map(id => CARS_BY_ID[id])
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
  const src = n.dataset.src ?? n.textContent ?? ''
  n.dataset.src = src
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

/** Scroll-triggered entrance animations, the ticker and the hero parallax. */
function useLandingMotion(root: RefObject<HTMLDivElement | null>, marquee: RefObject<HTMLDivElement | null>, parallax: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || reduced()) return
    const anims = new Map<Element, Animation[]>()
    el.querySelectorAll<HTMLElement>('[data-anim]').forEach(n => {
      const type = n.dataset.anim!
      const a = n.animate(KF[type], { duration: DUR[type], delay: +(n.dataset.delay ?? 0), easing: type === 'sweep' || type === 'wipe' ? EASE : OUT, fill: 'both' })
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
    const t = setTimeout(check, 300)

    let mq: Animation | undefined
    const m = marquee.current
    const slow = () => mq?.updatePlaybackRate(0.25), fast = () => mq?.updatePlaybackRate(1)
    if (m) {
      mq = m.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 60000, iterations: Infinity })
      m.parentElement?.addEventListener('mouseenter', slow)
      m.parentElement?.addEventListener('mouseleave', fast)
    }
    const onScroll = () => {
      const p = parallax.current
      if (p) p.style.transform = `translateY(${Math.min(window.scrollY, 800) * 0.06}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(t)
      io.disconnect()
      mq?.cancel()
      m?.parentElement?.removeEventListener('mouseenter', slow)
      m?.parentElement?.removeEventListener('mouseleave', fast)
      window.removeEventListener('scroll', onScroll)
      anims.forEach(list => list.forEach(a => a.finish()))
    }
  }, [root, marquee, parallax])
}

function TierCard({ car }: { car: Car }) {
  const leg = car.tier === 'Legendary'
  const bar = { Common: 'var(--color-neutral-400)', Rare: 'var(--color-text)', Epic: 'var(--color-accent-400)', Legendary: 'var(--color-accent-700)' }[car.tier]
  const fg = { Common: 'var(--color-neutral-700)', Rare: 'var(--color-text)', Epic: 'var(--color-accent-700)', Legendary: 'inherit' }[car.tier]
  return (
    <div className={`lp-car${leg ? ' leg' : ''}`}>
      <div style={{ height: 6, background: bar }} />
      <Photo car={car} style={{ aspectRatio: '4 / 3' }} />
      <div className="lp-car-body">
        <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: fg, fontWeight: leg ? 800 : 600 }}>{car.tier}</span>
        <span style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{car.model}{car.gen && <span className={leg ? '' : 'gen'} style={{ fontWeight: 400, paddingLeft: 6 }}>{car.gen}</span>}</span>
        <span style={{ fontSize: 12, color: leg ? 'inherit' : 'var(--color-neutral-700)' }}>{car.make} · {car.year} · {car.hp} hp</span>
      </div>
    </div>
  )
}

export function LandingPage() {
  const signedIn = useApp(s => !!s.snapshot)
  const root = useRef<HTMLDivElement>(null), marquee = useRef<HTMLDivElement>(null), parallax = useRef<HTMLDivElement>(null)
  useLandingMotion(root, marquee, parallax)
  const login = signedIn ? '/garage' : '/login'
  const hero = CARS_BY_ID['porsche-911-rs27']

  return (
    <div className="lp" ref={root}>
      <nav className="lp-nav">
        <span className="lp-brand">MARQUE</span>
        <a href="#how" className="lp-navlink">How it works</a>
        <a href="#cars" className="lp-navlink">The cars</a>
        <Link to={login} className="lp-navlink lp-login">{signedIn ? 'My garage' : 'Log in'}</Link>
        <Link to="/signup" className="btn btn-primary">Play free</Link>
      </nav>

      <div className="lp-wrap">
        <section className="lp-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <h1 className="lp-h1">
              <span className="lp-mask"><span data-anim="line" data-delay="0">{CATALOG.length} real cars.</span></span>
              <span className="lp-mask"><span data-anim="line" data-delay="110">One garage.</span></span>
              <span className="lp-mask"><span data-anim="line" data-delay="220" style={{ color: 'var(--color-accent)' }}>Fill it.</span></span>
            </h1>
            <p data-anim="up" data-delay="420" className="lp-lede">MARQUE is a collection game for people who know an E30 from an E36. Open packs, race for rare models and trade with other players. Every car comes with its real specs, generation code and history.</p>
            <div data-anim="up" data-delay="540" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary lp-cta" style={{ minWidth: 220 }}>Open your free pack</Link>
              <a href="#how" className="btn btn-secondary lp-cta">See how it works</a>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="lp-shot">
              <div data-anim="wipe" data-delay="250" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <div ref={parallax} className="photo" style={{ position: 'absolute', inset: '-8% 0', background: 'repeating-linear-gradient(135deg,var(--color-surface) 0 10px,var(--color-neutral-300) 10px 20px)' }}>
                  <span style={{ fontSize: 11 }}>hero shot · car in profile, black and white</span>
                </div>
              </div>
              <div data-anim="sweep" data-delay="250" className="lp-sweep" />
            </div>
            <span data-anim="up" data-delay="900" style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{hero.make} {carLabel(hero)} · {hero.year} · {hero.tier}</span>
          </div>
        </section>

        <div data-anim="rule" className="lp-rule" />

        <section className="lp-stats">
          {[[String(CATALOG.length), 'Licensed models'], [`${Math.min(...years)}–${Math.max(...years)}`, 'Decades of cars'], ['4', 'Rarity tiers'], ['90 s', 'Average race']].map(([v, k], i) => (
            <div key={k} data-anim="up" data-delay={i * 90} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span data-count="1" className="lp-stat tnum">{v}</span>
              <span className="lp-stat-k">{k}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="lp-ticker">
        <div ref={marquee} className="lp-ticker-row">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="lp-tick"><span>{t}</span><span className="lp-dot" /></span>
          ))}
        </div>
      </div>

      <div className="lp-wrap">
        <section id="how" className="lp-how">
          <span data-anim="up" className="lp-kicker">How it works</span>
          {[
            ['01', 'Open packs', 'Five cars per pack, with published odds for every tier. Duplicates convert to credits, and a Legendary is guaranteed at least once every 20 packs.'],
            ['02', 'Race to win cars', 'Short real-time races against other players. Power, torque, weight and upgrades all count. Winning earns season points, and event wins unlock cars you can’t get from packs.'],
            ['03', 'Trade on the market', 'Buy, sell or swap with other collectors. Each listing shows twelve weeks of sale prices, so you know whether that R34 is a deal.'],
          ].map(([n, t, d], i) => (
            <div key={n} data-anim="up" className={`lp-step${i ? ' rule-t' : ''}`}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{n}</span>
              <div className="lp-step-body">
                <h2>{t}</h2>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="cars" className="lp-cars">
          <div className="lp-cars-head">
            <h2 data-anim="up">From Golf GTI to McLaren F1</h2>
            <p>Everyday heroes, JDM icons, Italian supercars and concept cars, sorted into four tiers.</p>
          </div>
          <div className="lp-cards">
            {TIER_CARDS.map((c, i) => <div key={c.id} data-anim="up" data-delay={i * 100}><TierCard car={c} /></div>)}
          </div>
        </section>
      </div>

      <section className="lp-close">
        <div className="lp-wrap lp-close-inner">
          <h2 className="lp-close-h">
            <span className="lp-mask"><span data-anim="line" data-delay="0">Your first pack is free.</span></span>
            <span className="lp-mask"><span data-anim="line" data-delay="120">Your first Legendary is up to you.</span></span>
          </h2>
          <div data-anim="up" data-delay="300" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/signup" className="btn lp-cta lp-cta-light" style={{ minWidth: 240 }}>Create your garage</Link>
            <Link to={login} className="btn lp-cta lp-cta-ghost">Log in</Link>
          </div>
        </div>
      </section>

      <footer className="lp-wrap lp-foot">
        <span style={{ fontWeight: 800, color: 'var(--color-text)', marginRight: 'auto' }}>MARQUE</span>
        <a href="#how">How it works</a>
        <a href="#cars">The cars</a>
        <Link to="/packs">Pack odds</Link>
        <a href="#how">Terms</a>
      </footer>
    </div>
  )
}
