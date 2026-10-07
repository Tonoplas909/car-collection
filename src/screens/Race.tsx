import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CARS_BY_ID, DT, GEARS, OPPONENTS, RACE_EVENTS, RACE_EVENTS_BY_ID, RaceSim, SHIFT_WINDOW, TIER_RANK, calibrateOpponents,
  type Car, type RaceEvent, type ShiftQuality,
} from '@game'
import { GameError, type RaceResult } from '../api'
import { Aside, Main, MobileHead } from '../components/Shell'
import { ConfirmDialog, EmptyState, ModelName, Photo, TIER_BAR } from '../components/ui'
import { cr, num, seconds } from '../lib/format'
import { useIsMobile, useWipeNavigate } from '../lib/hooks'
import { animateRacePanel, sweep } from '../lib/motion'
import { actions, getState, useApp, useSnapshot } from '../state/store'
import './Race.css'

const lenStr = (e: RaceEvent) => `${num(e.len)} m`

/** Enter the selected race (charges the entry fee) and go to the live screen. */
function useFindRace() {
  const navigate = useWipeNavigate()
  const [phase, setPhase] = useState<'idle' | 'searching' | 'timeout'>('idle')
  const [short, setShort] = useState<RaceEvent | null>(null)
  const [error, setError] = useState('')
  const find = async () => {
    setError('')
    setPhase('searching')
    // Matchmaking: the mock finds opponents after a short search. Offline players time out (9c).
    await new Promise(r => setTimeout(r, 900))
    if (!navigator.onLine) { setPhase('timeout'); return }
    try {
      await actions.enterRace()
      navigate('/race/live')
    } catch (e) {
      setPhase('idle')
      if (e instanceof GameError && e.code === 'insufficient_credits') setShort(RACE_EVENTS_BY_ID[getState().race.eventId])
      else setError((e as Error).message)
    }
  }
  const dialog = short && (
    <ConfirmDialog kind="Low credits" title={`You need ${cr(short.fee)}.`} rows={[['Entry fee', cr(short.fee)]]}
      note="Win a cheaper event, sell a car or top up to enter." ok="Top up credits"
      onOk={() => { setShort(null); navigate('/credits') }} onCancel={() => setShort(null)} />
  )
  return { find, phase, setPhase, dialog, error }
}

function useSetup() {
  const snap = useSnapshot()
  const race = useApp(s => s.race)
  const cars = useMemo(() => snap.garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car)
    .sort((a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.hp - a.car.hp), [snap.garage])
  const current = cars.find(c => c.carId === race.carId) ?? cars[0]
  const ev = RACE_EVENTS_BY_ID[race.eventId]
  useEffect(() => {
    if (current && current.carId !== race.carId) actions.setRace({ carId: current.carId })
  }, [current, race.carId])
  return { cars, current, ev, credits: snap.user.credits }
}

export function RaceSetupPage() {
  return useIsMobile() ? <RaceSetupMobile /> : <RaceSetupDesktop />
}

const TIMEOUT = (retry: () => void) => ({
  glyph: '!', tone: 'red' as const, title: 'No opponents found.', text: 'We looked for 30 seconds. Try again when you are back online.',
  cta: { label: 'Search again', onClick: retry }, alt: { label: 'Back to garage', to: '/garage' },
})
const NO_CARS = { glyph: '0', title: 'No cars yet.', text: 'You need a car to race. Open your free pack first.', cta: { label: 'Open a pack', to: '/packs' } }

function RaceSetupDesktop() {
  const { cars, current, ev } = useSetup()
  const { find, phase, setPhase, dialog, error } = useFindRace()
  const hdr = useRef<HTMLDivElement>(null), title = useRef<HTMLSpanElement>(null), opps = useRef<HTMLDivElement>(null)
  const rew = useRef<HTMLDivElement>(null), note = useRef<HTMLParagraphElement>(null)
  const pending = useRef(false)
  useLayoutEffect(() => {
    if (!pending.current) return
    pending.current = false
    animateRacePanel({ hdr: hdr.current, title: title.current, opps: opps.current, rewards: rew.current, note: note.current })
  }, [ev.id, current?.carId])

  if (!current) return <Main><div className="page-head"><span className="page-title">Race</span></div><EmptyState {...NO_CARS} /></Main>
  if (phase === 'timeout') return <Main><div className="page-head"><span className="page-title">Race</span></div><EmptyState {...TIMEOUT(() => { setPhase('idle'); void find() })} /></Main>

  const car = current.car
  return (
    <>
      <Main>
        <div className="page-head">
          <span className="page-title">Race</span>
          <span className="meta">4 players · matched by garage level</span>
        </div>
        <div className="rc-step">1 · Event</div>
        <div className="split rc-events">
          {RACE_EVENTS.map(e => (
            <button key={e.id} className={`rc-event${e.id === ev.id ? ' on' : ''}`}
              onClick={evt => { if (e.id === ev.id) return; sweep(evt.currentTarget); pending.current = true; actions.setRace({ eventId: e.id }) }}>
              <span className="label" style={{ color: 'inherit' }}>{e.kind}</span>
              <span className="rc-len tnum">{lenStr(e)}</span>
              <span style={{ fontSize: 13 }}>{e.place}</span>
            </button>
          ))}
        </div>
        <div className="rc-step" style={{ paddingTop: 20 }}>2 · Car</div>
        <div className="rc-cars">
          {cars.map((x, i) => (
            <div key={x.carId} className={`rc-car clickable list-row${x.carId === current.carId ? ' on' : ''}`} style={{ '--i': i } as CSSProperties}
              onClick={evt => { if (x.carId === current.carId) return; sweep(evt.currentTarget); pending.current = true; actions.setRace({ carId: x.carId }) }}>
              <span style={{ alignSelf: 'stretch', background: TIER_BAR[x.car.tier] }} />
              <Photo car={x.car} label="car" className="rc-thumb" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}><ModelName car={x.car} /></span>
                <span className="muted" style={{ fontSize: 12 }}>{x.car.make} · {x.car.tier} · Lv {x.level}</span>
              </div>
              <Spec k="Power" v={`${x.car.hp} hp`} />
              <Spec k="Weight" v={`${num(x.car.kg)} kg`} />
              <Spec k="hp / tonne" v={String(Math.round((x.car.hp / x.car.kg) * 1000))} />
            </div>
          ))}
        </div>
      </Main>
      <Aside width={380}>
        <div ref={hdr} className="red-head">
          <span className="kicker" style={{ fontWeight: 800 }}>{ev.kind} · {lenStr(ev)}</span>
          <span className="mk">{car.make}</span>
          <span ref={title} className="model" style={{ fontSize: 40 }}>{car.model}</span>
        </div>
        <div className="label" style={{ padding: '16px 24px 8px' }}>Opponents</div>
        <div ref={opps} className="rc-opps">
          {OPPONENTS.map(o => (
            <div key={o.name}><span style={{ fontWeight: 600 }}>{o.name}</span><span className="muted" style={{ marginLeft: 'auto' }}>{o.car}</span></div>
          ))}
        </div>
        <div ref={rew} className="split rc-rewards">
          <div><span className="label-sm">Entry</span><span>{cr(ev.fee)}</span></div>
          <div><span className="label-sm">Win</span><span>{cr(ev.win)}</span></div>
          <div><span className="label-sm">Points</span><span>+{ev.points}</span></div>
        </div>
        <p ref={note} className="rc-note">{ev.note}</p>
        <div style={{ padding: '16px 24px 24px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <span className="err">{error}</span>}
          <button className="btn btn-primary rc-find" onClick={find} disabled={phase === 'searching'}>
            {phase === 'searching' ? 'Searching for opponents…' : 'Find race'}
          </button>
        </div>
      </Aside>
      {dialog}
    </>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}><span className="label-sm">{k}</span><span className="tnum" style={{ fontWeight: 800 }}>{v}</span></div>
}

function RaceSetupMobile() {
  const { cars, current, ev } = useSetup()
  const { find, phase, setPhase, dialog, error } = useFindRace()
  if (!current) return <><MobileHead title="Race" /><EmptyState {...NO_CARS} /></>
  if (phase === 'timeout') return <><MobileHead title="Race" /><EmptyState {...TIMEOUT(() => { setPhase('idle'); void find() })} /></>
  return (
    <>
      <MobileHead title="Race" />
      <div className="split rc-events-m">
        {RACE_EVENTS.map(e => (
          <button key={e.id} className={`rc-event${e.id === ev.id ? ' on' : ''}`} onClick={() => actions.setRace({ eventId: e.id })}>
            <span className="label-sm" style={{ color: 'inherit' }}>{e.id === 'run' ? 'Highway' : e.kind}</span>
            <span style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{lenStr(e)}</span>
          </button>
        ))}
      </div>
      <div className="label" style={{ padding: '12px 16px 6px' }}>Choose a car</div>
      <div className="mscroll" style={{ borderTop: '1px solid var(--color-divider)' }}>
        {cars.map(x => (
          <div key={x.carId} className={`rc-car-m clickable${x.carId === current.carId ? ' on' : ''}`} onClick={() => actions.setRace({ carId: x.carId })}>
            <span style={{ alignSelf: 'stretch', background: TIER_BAR[x.car.tier] }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}><ModelName car={x.car} /></span>
              <span className="muted" style={{ fontSize: 12 }}>{x.car.hp} hp · {num(x.car.kg)} kg · Lv {x.level}</span>
            </div>
            <span style={{ paddingRight: 16, fontWeight: 800, fontSize: 13 }}>{Math.round((x.car.hp / x.car.kg) * 1000)} hp/t</span>
          </div>
        ))}
      </div>
      <div className="m-actions" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', fontSize: 13 }}><span>Entry {cr(ev.fee)}</span><span style={{ marginLeft: 'auto' }}>Win {cr(ev.win)} · +{ev.points} pts</span></div>
        {error && <span className="err">{error}</span>}
        <button className="btn btn-primary btn-lg" onClick={find} disabled={phase === 'searching'}>{phase === 'searching' ? 'Searching…' : 'Find race'}</button>
      </div>
      {dialog}
    </>
  )
}

/* ── Live race (5b, 6f) ─────────────────────────────────────────────── */

type Phase = 'idle' | 'count' | 'race' | 'submitting' | 'done'

interface View {
  t: number; d: number; v: number; gear: number; rpm: number; quality: ShiftQuality | null
}

export function RaceLivePage() {
  const current = useApp(s => s.raceEntry)
  const snap = useApp(s => s.snapshot)
  // Hold the entry this screen started with: finishing the race clears it from the store.
  const [entry] = useState(current)
  if (!entry || !snap) return <Navigate to="/race" replace />
  const owned = snap.garage.find(g => g.carId === entry.carId)
  return <LiveRace key={entry.raceId} car={CARS_BY_ID[entry.carId]} level={owned?.level ?? 0} ev={RACE_EVENTS_BY_ID[entry.eventId]} opponents={entry.opponents} />
}

function LiveRace({ car, level, ev, opponents }: { car: Car; level: number; ev: RaceEvent; opponents: { name: string; car: string }[] }) {
  const mobile = useIsMobile()
  const navigate = useWipeNavigate()
  const spec = useMemo(() => ({ hp: car.hp, kg: car.kg, top: car.top, level }), [car, level])
  const opps = useMemo(() => calibrateOpponents(spec, ev.len).map((o, i) => ({ ...o, name: opponents[i]?.name ?? o.name, car: opponents[i]?.car ?? o.car })), [spec, ev.len, opponents])
  const sim = useRef(new RaceSim(spec, ev.len))
  const shifts = useRef<number[]>([])
  const phaseRef = useRef<Phase>('idle')
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [view, setView] = useState<View>({ t: 0, d: 0, v: 0, gear: 1, rpm: 0, quality: null })
  const [result, setResult] = useState<RaceResult | null>(null)
  const [error, setError] = useState('')
  const raf = useRef(0)

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const finish = useCallback(async () => {
    go('submitting')
    try {
      const r = await actions.finishRace(shifts.current)
      setResult(r)
      go('done')
    } catch (e) {
      setError((e as Error).message)
      go('done')
    }
  }, [])

  const start = useCallback(() => {
    cancelAnimationFrame(raf.current)
    go('count')
    let last = performance.now(), cd = 3, acc = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phaseRef.current === 'count') {
        cd -= dt
        if (cd <= 0) go('race')
        else setCount(Math.ceil(cd))
      } else if (phaseRef.current === 'race') {
        acc += dt
        const s = sim.current
        while (acc >= DT && !s.s.finished) { s.step(); acc -= DT }
        setView(v => ({ ...v, t: s.s.t, d: Math.min(ev.len, s.s.d), v: s.s.v, gear: s.s.gear, rpm: s.s.rpm }))
        if (s.s.finished) { void finish(); return }
      }
      if (phaseRef.current === 'count' || phaseRef.current === 'race') raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [ev.len, finish])

  const shift = useCallback(() => {
    if (phaseRef.current !== 'race') return
    const s = sim.current
    const step = s.s.step
    const q = s.shift()
    if (!q) return
    shifts.current.push(step)
    setView(v => ({ ...v, gear: s.s.gear, rpm: s.s.rpm, quality: q }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && phaseRef.current === 'race') { e.preventDefault(); shift() } }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf.current) }
  }, [shift])

  const racing = phase === 'race' || phase === 'submitting' || phase === 'done'
  const tNow = racing ? view.t : 0
  const lanes = [
    { name: 'You', car: `${car.make} ${car.model}`, d: view.d, me: true, bar: TIER_BAR[car.tier] },
    ...opps.map(o => ({ name: o.name, car: o.car, d: o.distanceAt(tNow), me: false, bar: 'var(--color-neutral-500)' })),
  ]
  const pos = [...lanes].sort((a, b) => b.d - a.d).findIndex(l => l.me) + 1
  const ticks = Array.from({ length: Math.ceil(ev.len / 100) - 1 }, (_, i) => ((i + 1) * 100) / ev.len * 100)
  const rpmBg = view.rpm >= SHIFT_WINDOW.perfect ? 'var(--color-accent)' : view.rpm >= SHIFT_WINDOW.start ? 'var(--color-accent-600)' : 'var(--color-text)'
  const hud = { pos: phase === 'idle' || phase === 'count' ? '—' : `${result?.place ?? pos} / 4`, time: seconds(tNow), togo: `${Math.max(0, Math.round(ev.len - view.d))} m` }

  const overlay = phase === 'idle' ? { big: 'Ready', sub: 'Three opponents found. Press start, then shift up in the window.', fg: 'var(--color-text)', btn: 'Start race', act: start }
    : phase === 'count' ? { big: String(count), sub: 'Get ready', fg: 'var(--color-text)' }
    : phase === 'submitting' ? { big: '…', sub: 'Checking times', fg: 'var(--color-text)' }
    : phase === 'done' ? (result
      ? { big: `P${result.place}`, sub: `${seconds(result.time)} · ${result.place === 1 ? 'you won' : 'race over'}`, fg: result.place === 1 ? 'var(--color-accent)' : 'var(--color-text)', btn: 'See results', act: () => navigate('/race/results') }
      : { big: '!', sub: error || 'The result could not be saved.', fg: 'var(--color-accent)', btn: 'Back to race setup', act: () => navigate('/race') })
    : null

  if (mobile) {
    const btn = phase === 'race' ? { label: 'Shift up', act: shift } : overlay?.btn ? { label: overlay.btn, act: overlay.act! } : { label: overlay?.big ?? '', act: () => {} }
    return (
      <div className="mshell">
        <div className="lv-hud-m">
          <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="To go" v={hud.togo} />
        </div>
        <div className="lv-lanes-m">
          {lanes.map(l => {
            const p = Math.min(100, (l.d / ev.len) * 100)
            return (
              <div key={l.name} className={`lv-lane-m${l.me ? ' me' : ''}`}>
                <span className="lv-lane-name">{l.name}</span>
                <span className="lv-finish" />
                <div className="lv-track-m">
                  <div className="lv-chip" style={{ left: `${p}%`, transform: `translate(-${p}%, -50%)` }}>
                    <span style={{ width: 6, height: 30, background: l.me ? 'var(--color-accent)' : l.bar }} />
                    <span className="lv-chip-label" style={{ height: 30, fontSize: 12 }}>{l.me ? `YOU · ${Math.round(l.d)} m` : `${Math.round(l.d)} m`}</span>
                  </div>
                </div>
              </div>
            )
          })}
          {overlay && phase !== 'idle' && phase !== 'done' && <div className="lv-overlay-m"><span style={{ color: overlay.fg }}>{overlay.big}</span></div>}
        </div>
        <div className="lv-gauges-m">
          <div><span className="label-sm">Speed</span><span className="lv-big-m tnum">{Math.round(view.v * 3.6)}</span><span className="lv-unit">km/h</span></div>
          <div><span className="label-sm">Gear</span><span className="lv-big-m">{view.gear}</span><span className="lv-unit">of {GEARS}</span></div>
        </div>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
          <RevBar rpm={view.rpm} bg={rpmBg} height={36} />
          <span className="muted" style={{ fontSize: 11 }}>
            {phase === 'idle' ? 'Press Start, then shift in the marked window' : phase === 'done' ? overlay?.sub : view.quality ? `${view.quality} shift` : 'Shift in the marked window'}
          </span>
        </div>
        <div style={{ padding: '0 16px calc(16px + env(safe-area-inset-bottom))', flex: 'none' }}>
          <button className="lv-shift-m" onClick={btn.act} disabled={phase === 'count' || phase === 'submitting'}>{btn.label}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lv-screen">
      <div className="lv-top">
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="label">{ev.kind} · {ev.place}</span>
          <span style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.1 }}><ModelName car={car} /></span>
        </div>
        <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="To go" v={hud.togo} />
      </div>
      <div className="lv-lanes">
        {lanes.map(l => {
          const p = Math.min(100, (l.d / ev.len) * 100)
          return (
            <div key={l.name} className={`lv-lane${l.me ? ' me' : ''}`}>
              <div className="lv-who"><span style={{ fontWeight: 800, fontSize: 15 }}>{l.name}</span><span className="muted" style={{ fontSize: 12 }}>{l.car}</span></div>
              <div className="lv-track">
                {ticks.map(t => <span key={t} className="lv-tick" style={{ left: `${t}%` }} />)}
                <span className="lv-line" />
                <div className="lv-chip" style={{ left: `${p}%`, transform: `translate(-${p}%, -50%)` }}>
                  <span style={{ width: 6, height: 36, background: l.bar }} />
                  <span className="lv-chip-label tnum">{l.me ? `YOU · ${Math.round(l.d)} m` : `${Math.round(l.d)} m`}</span>
                </div>
              </div>
            </div>
          )
        })}
        {overlay && (
          <div className="lv-overlay">
            <span className="lv-overlay-big" style={{ color: overlay.fg }}>{overlay.big}</span>
            <span style={{ fontSize: 17, color: 'var(--color-neutral-800)' }}>{overlay.sub}</span>
            {overlay.btn && <button className="btn btn-primary lv-start" onClick={overlay.act}>{overlay.btn}</button>}
          </div>
        )}
      </div>
      <div className="lv-bottom">
        <div className="lv-gauge"><span className="label">Speed</span><span className="lv-big tnum">{Math.round(view.v * 3.6)}</span><span className="lv-unit">km/h</span></div>
        <div className="lv-gauge"><span className="label">Gear</span><span className="lv-big">{view.gear}</span><span className="lv-unit">of {GEARS}</span></div>
        <div className="lv-gauge" style={{ gap: 12 }}>
          <div className="label" style={{ display: 'flex' }}>
            <span>Revs</span>
            <span style={{ marginLeft: 'auto', fontWeight: 800, color: view.quality === 'Perfect' ? 'var(--color-accent-700)' : 'var(--color-text)' }}>{view.quality ? `${view.quality} shift` : ''}</span>
          </div>
          <RevBar rpm={view.rpm} bg={rpmBg} height={48} />
          <div className="lv-rev-legend"><span>0</span><span>Shift window</span><span /></div>
        </div>
        <div className="lv-gauge" style={{ gap: 10 }}>
          <button className="btn btn-primary lv-shift" onClick={shift} disabled={phase !== 'race' || view.gear >= GEARS}>Shift up</button>
          <span className="muted" style={{ fontSize: 12 }}>or press the space bar</span>
        </div>
      </div>
    </div>
  )
}

function Hud({ k, v }: { k: string; v: string }) {
  return <div className="lv-hud"><span className="label">{k}</span><span className="lv-hud-v tnum">{v}</span></div>
}

function RevBar({ rpm, bg, height }: { rpm: number; bg: string; height: number }) {
  return (
    <div className="lv-rev" style={{ height }}>
      <span style={{ left: `${SHIFT_WINDOW.start * 100}%`, width: `${(SHIFT_WINDOW.perfect - SHIFT_WINDOW.start) * 100}%`, background: 'var(--color-neutral-400)' }} />
      <span style={{ left: `${SHIFT_WINDOW.perfect * 100}%`, right: 0, background: 'var(--color-accent-300)' }} />
      <span style={{ left: 0, width: `${Math.round(rpm * 100)}%`, background: bg }} />
    </div>
  )
}

/* ── Results (5c, 6i) ───────────────────────────────────────────────── */

export function RaceResultsPage() {
  const result = useApp(s => s.raceResult)
  const mobile = useIsMobile()
  const navigate = useWipeNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!result) return <Navigate to="/race" replace />
  const ev = RACE_EVENTS_BY_ID[result.eventId]
  const won = result.place === 1
  const best = result.rows[0].time
  const headline = won ? 'You won.' : result.place === 2 ? 'So close.' : 'Not this time.'
  const shiftsList: ShiftQuality[] | ['—'] = result.shifts.length ? result.shifts : ['—']
  const again = async () => {
    setBusy(true); setError('')
    try { actions.setRace({ eventId: result.eventId, carId: result.carId }); await actions.enterRace(); navigate('/race/live') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const rewards: [string, string][] = [['Season points', `+${result.rewards.points}`], ['Credits', `+${cr(result.rewards.credits)}`], ['XP', `+${result.rewards.xp}`]]
  const heroStyle = { background: won ? 'var(--color-accent)' : 'var(--color-text)', color: 'var(--color-bg)' }

  if (mobile) {
    return (
      <div className="mshell">
        <div className="rs-hero-m" style={heroStyle}>
          <span className="rs-place-m">P{result.place}</span>
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{headline}</span>
            <span style={{ fontSize: 12 }}>{ev.kind} · {lenStr(ev)} · {ev.place}</span>
          </div>
        </div>
        <div className="mscroll">
          {result.rows.map((r, i) => (
            <div key={r.name} className="rs-row-m list-row" style={{ '--i': i, background: r.me ? 'var(--color-surface)' : 'transparent' } as CSSProperties}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>P{i + 1}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</span><span className="muted" style={{ fontSize: 11 }}>{r.car}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span className="tnum" style={{ fontWeight: 800 }}>{seconds(r.time)}</span><span style={{ fontSize: 11 }}>{i ? `+${(r.time - best).toFixed(2)}` : '—'}</span></div>
            </div>
          ))}
        </div>
        <div className="split rs-rew-m">
          <div><span className="label-sm">Points</span><span>+{result.rewards.points}</span></div>
          <div><span className="label-sm">Credits</span><span>+{result.rewards.credits >= 1000 ? `${(result.rewards.credits / 1000).toFixed(1)}k` : result.rewards.credits}</span></div>
          <div><span className="label-sm">XP</span><span>+{result.rewards.xp}</span></div>
        </div>
        <div className="m-actions" style={{ borderTop: 0 }}>
          {error && <span className="err">{error}</span>}
          <button className="btn btn-primary btn-md" onClick={again} disabled={busy}>{busy ? 'Entering…' : `Race again · ${cr(ev.fee)}`}</button>
          <Link to="/garage" className="btn btn-secondary btn-md">Back to garage</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rs-screen">
      <div className="rs-main">
        <div className="rs-hero" style={heroStyle}>
          <span className="rs-place">P{result.place}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 36, lineHeight: 1 }}>{headline}</span>
            <span style={{ fontSize: 15 }}>{ev.kind} · {lenStr(ev)} · {ev.place}</span>
          </div>
        </div>
        <div className="rs-grid rs-th"><span>Pos</span><span>Player</span><span style={{ textAlign: 'right' }}>Time</span><span style={{ textAlign: 'right' }}>Gap</span></div>
        {result.rows.map((r, i) => (
          <div key={r.name} className="rs-grid rs-tr list-row" style={{ '--i': i, background: r.me ? 'var(--color-surface)' : 'transparent' } as CSSProperties}>
            <span style={{ fontWeight: 800, fontSize: 24 }}>P{i + 1}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800, fontSize: 16 }}>{r.name}</span><span style={{ fontSize: 12 }}>{r.car}</span></div>
            <span className="tnum" style={{ textAlign: 'right', fontWeight: 800, fontSize: 18 }}>{seconds(r.time)}</span>
            <span className="tnum" style={{ textAlign: 'right', fontSize: 14 }}>{i ? `+${(r.time - best).toFixed(2)}` : '—'}</span>
          </div>
        ))}
        <div className="split rs-stats">
          <div><span className="label">Your time</span><span className="tnum">{seconds(result.time)}</span></div>
          <div><span className="label">Top speed</span><span className="tnum">{Math.round(result.top * 3.6)} km/h</span></div>
          <div><span className="label">Perfect shifts</span><span className="tnum">{result.shifts.filter(q => q === 'Perfect').length} / {result.shifts.length}</span></div>
          <div><span className="label">Gear reached</span><span className="tnum">{result.shifts.length + 1}</span></div>
        </div>
      </div>
      <aside className="rs-aside">
        <div className="label" style={{ padding: '24px 24px 8px' }}>Rewards</div>
        <div style={{ padding: '0 24px' }}>
          {rewards.map(([k, v]) => (
            <div key={k} className="rs-reward"><span style={{ fontSize: 15 }}>{k}</span><span className="tnum">{v}</span></div>
          ))}
        </div>
        <div className="rs-shifts">
          <span className="label">Shifts</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {shiftsList.map((q, i) => {
              const style = q === 'Perfect' ? { background: 'var(--color-accent)', color: 'var(--color-bg)' } : q === 'Late' ? { background: 'var(--color-text)', color: 'var(--color-bg)' } : { background: 'var(--color-neutral-200)', color: 'var(--color-text)' }
              return <span key={i} className="rs-shift" style={style}>{q}</span>
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 24px 24px', marginTop: 'auto' }}>
          {error && <span className="err">{error}</span>}
          <button className="btn btn-primary rs-btn" onClick={again} disabled={busy}>{busy ? 'Entering…' : `Race again · ${cr(ev.fee)}`}</button>
          <Link to="/race" className="btn btn-secondary rs-btn">Change car or event</Link>
          <Link to="/garage" className="btn btn-secondary rs-btn">Back to garage</Link>
        </div>
      </aside>
    </div>
  )
}
