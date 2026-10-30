import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CARS_BY_ID, CircuitSim, DT, MAX_RACE_SECONDS, NITRO, RACE_EVENTS, RACE_EVENTS_BY_ID, RaceInputRecorder, TIER_RANK,
  carNotes, cornerCue, cueAdvice, isCorner, nextCorner, opponentTraces, raceSpec, trackFor,
  type Car, type Focus, type RaceEvent, type ShiftQuality,
} from '@game'
import { GameError, topUpEnabled, type RaceResult } from '../api'
import { Aside, Main, MobileHead } from '../components/Shell'
import { CornerCue } from '../components/CornerCue'
import { Hud } from '../components/Hud'
import { RaceMap } from '../components/RaceMap'
import { ConfirmDialog, EmptyState, ModelName, Photo, TIER_BAR } from '../components/ui'
import { cr, num, seconds } from '../lib/format'
import { useIsMobile, useWipeNavigate } from '../lib/hooks'
import { animateRacePanel, sweep } from '../lib/motion'
import { actions, getState, useApp, useSnapshot } from '../state/store'
import { DragRace } from './DragRace'
import './Race.css'

const lenStr = (e: RaceEvent) => `${num(e.len)} m`
const gripOf = (car: Car, level: number) => Math.round(carNotes(raceSpec(car, level)).G * 100)
const FOCUS: Record<Focus, [string, string]> = {
  accel: ['Acceleration', 'Power-to-weight'],
  grip: ['Grip and braking', 'Light, recent cars'],
  top: ['Top speed', 'Long straights'],
}
const SECTOR_NAME = { straight: 'Straight', sweeper: 'Fast bend', chicane: 'Chicane', hairpin: 'Hairpin', climb: 'Climb' } as const
const kmh = (v: number) => Math.round(v * 3.6)
/** Colours of the corner and shift strip on the results screen, from best to worst */
const QUALITY_STYLE: Record<string, { background: string; color: string }> = {
  Perfect: { background: 'var(--color-accent)', color: 'var(--color-bg)' },
  Great: { background: 'var(--color-accent-600)', color: 'var(--color-bg)' },
  OK: { background: 'var(--color-neutral-300)', color: 'var(--color-text)' },
  Early: { background: 'var(--color-neutral-200)', color: 'var(--color-text)' },
  Late: { background: 'var(--color-text)', color: 'var(--color-bg)' },
}

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
      note={topUpEnabled ? 'Win a cheaper event, sell a car or top up to enter.' : 'Win a cheaper event or sell a car to enter.'} ok={topUpEnabled ? 'Top up credits' : 'Close'}
      onOk={() => { setShort(null); if (topUpEnabled) navigate('/credits') }} onCancel={() => setShort(null)} />
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
          <span className="meta">4 players · matched by rarity</span>
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
              <Spec k="Grip" v={String(gripOf(x.car, x.level))} />
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
        <div className="rc-map"><RaceMap track={trackFor(ev.id)} size="sm" /></div>
        <div className="label" style={{ padding: '16px 24px 8px' }}>What counts</div>
        <div ref={opps} className="rc-opps">
          {trackFor(ev.id).focus.map(f => (
            <div key={f}><span style={{ fontWeight: 600 }}>{FOCUS[f][0]}</span><span className="muted" style={{ marginLeft: 'auto' }}>{FOCUS[f][1]}</span></div>
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
              <span className="muted" style={{ fontSize: 12 }}>{x.car.hp} hp · {num(x.car.kg)} kg · grip {gripOf(x.car, x.level)} · Lv {x.level}</span>
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
  t: number; d: number; v: number; sector: number; braking: boolean; nitroLeft: number; nitroT: number; slide: number
}

const isBrakeKey = (code: string) => code === 'Space' || code === 'ArrowDown'
const isNitroKey = (code: string) => code === 'KeyN' || code === 'ArrowUp'

export function RaceLivePage() {
  const current = useApp(s => s.raceEntry)
  const snap = useApp(s => s.snapshot)
  // Hold the entry this screen started with: finishing the race clears it from the store.
  const [entry] = useState(current)
  if (!entry || !snap) return <Navigate to="/race" replace />
  const owned = snap.garage.find(g => g.carId === entry.carId)
  const live = { raceId: entry.raceId, car: CARS_BY_ID[entry.carId], level: owned?.level ?? 0, ev: RACE_EVENTS_BY_ID[entry.eventId] }
  return entry.eventId === 'drag' ? <DragRace key={entry.raceId} {...live} /> : <LiveRace key={entry.raceId} {...live} />
}

function LiveRace({ raceId, car, level, ev }: { raceId: string; car: Car; level: number; ev: RaceEvent }) {
  const mobile = useIsMobile()
  const navigate = useWipeNavigate()
  const track = trackFor(ev.id)
  const [sim] = useState(() => new CircuitSim(raceSpec(car, level), track))
  const [rec] = useState(() => new RaceInputRecorder(sim))
  const traces = useMemo(() => opponentTraces(raceId, car, ev.id), [raceId, car, ev.id])
  const phaseRef = useRef<Phase>('idle')
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const read = useCallback((): View => {
    const s = sim.s
    return { t: s.t, d: Math.min(ev.len, s.d), v: s.v, sector: s.sector, braking: s.braking, nitroLeft: s.nitroLeft, nitroT: s.nitroT, slide: s.slide }
  }, [sim, ev.len])
  const [view, setView] = useState<View>(read)
  const [result, setResult] = useState<RaceResult | null>(null)
  const [error, setError] = useState('')
  const raf = useRef(0)

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const finish = useCallback(async () => {
    go('submitting')
    try {
      const r = await actions.finishRace(rec.inputs)
      setResult(r)
      go('done')
    } catch (e) {
      setError((e as Error).message)
      go('done')
    }
  }, [rec])

  const start = useCallback(() => {
    cancelAnimationFrame(raf.current)
    go('count')
    let last = performance.now(), cd = 3, acc = 0
    const over = () => sim.s.finished || sim.s.t >= MAX_RACE_SECONDS
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (phaseRef.current === 'count') {
        cd -= dt
        if (cd <= 0) go('race')
        else setCount(Math.ceil(cd))
      } else if (phaseRef.current === 'race') {
        acc += dt
        while (acc >= DT && !over()) { sim.step(); acc -= DT }
        setView(read())
        if (over()) { rec.releaseAll(); void finish(); return }
      }
      if (phaseRef.current === 'count' || phaseRef.current === 'race') raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [sim, rec, read, finish])

  const press = useCallback(() => { if (phaseRef.current === 'race') { rec.press(); setView(read()) } }, [rec, read])
  const release = useCallback(() => { rec.releaseAll(); setView(read()) }, [rec, read])
  const nitro = useCallback(() => { if (phaseRef.current === 'race') { rec.nitro(); setView(read()) } }, [rec, read])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!isBrakeKey(e.code) && !isNitroKey(e.code)) return
      e.preventDefault()
      if (e.repeat) return
      if (isBrakeKey(e.code)) press()
      else nitro()
    }
    const up = (e: KeyboardEvent) => { if (isBrakeKey(e.code)) release() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
      cancelAnimationFrame(raf.current)
    }
  }, [press, release, nitro])

  const racing = phase === 'race' || phase === 'submitting' || phase === 'done'
  const tNow = racing ? view.t : 0
  const lanes = [
    { name: 'You', car: `${car.make} ${car.model}`, d: view.d, me: true, bar: TIER_BAR[car.tier] },
    ...traces.map(o => ({ name: o.name, car: o.car, d: o.distanceAt(tNow), me: false, bar: 'var(--color-neutral-500)' })),
  ]
  const pos = [...lanes].sort((a, b) => b.d - a.d).findIndex(l => l.me) + 1
  const gear = Math.min(6, 1 + Math.floor((view.v / sim.notes.vmax) * 6))
  const hud = { pos: phase === 'idle' || phase === 'count' ? '—' : `${result?.place ?? pos} / 4`, time: seconds(tNow), sector: `${view.sector + 1} / ${track.sectors.length}` }

  const here = track.sectors[view.sector]
  const ahead = phase === 'race' ? nextCorner(track, view.sector, view.d) : null
  const next = ahead ? track.sectors[ahead.index] : null
  const cue = ahead && next ? cornerCue(sim.notes, next, view.v, ahead.dist) : null
  const approach = {
    label: next ? SECTOR_NAME[next.kind] : '',
    dist: ahead ? ahead.dist : null,
    v: view.v,
    cue,
    advice: cueAdvice(cue, view.v, view.braking, isCorner(here)),
    braking: view.braking,
    slide: phase === 'race' && view.slide > 0,
    note: phase !== 'race' ? ' '
      : view.slide > 0 ? 'You carried too much speed into the corner.'
      : isCorner(here) ? `${SECTOR_NAME[here.kind]}: hold on, the road opens up soon.`
      : 'Last straight. Use any nitro you have left.',
  }
  const stage = (
    <>
      <div className="lv-map"><RaceMap track={track} dots={lanes.map(l => ({ id: l.name, d: l.d, me: l.me }))} /></div>
      <div className="lv-standings">
        {[...lanes].sort((x, y) => y.d - x.d).map((l, i) => {
          const me = lanes[0].d
          return (
            <div key={l.name} className={`lv-stand${l.me ? ' me' : ''}`}>
              <span className="lv-stand-pos">P{i + 1}</span>
              <span className="lv-stand-who"><b>{l.me ? 'You' : l.name}</b><span className="muted">{l.car}</span></span>
              <span className="lv-stand-gap tnum">{l.me ? '' : `${l.d >= me ? '+' : '−'}${Math.abs(Math.round(l.d - me))} m`}</span>
            </div>
          )
        })}
      </div>
    </>
  )

  const overlay = phase === 'idle' ? { big: 'Ready', sub: 'Hold Brake (space) before corners and let go at the right speed. Tap Nitro (N) on exits.', fg: 'var(--color-text)', btn: 'Start race' }
    : phase === 'count' ? { big: String(count), sub: 'Get ready', fg: 'var(--color-text)' }
    : phase === 'submitting' ? { big: '…', sub: 'Checking times', fg: 'var(--color-text)' }
    : phase === 'done' ? (result
      ? { big: `P${result.place}`, sub: `${seconds(result.time)} · ${result.place === 1 ? 'you won' : 'race over'}`, fg: result.place === 1 ? 'var(--color-accent)' : 'var(--color-text)', btn: 'See results' }
      : { big: '!', sub: error || 'The result could not be saved.', fg: 'var(--color-accent)', btn: 'Back to race setup' })
    : null
  const onOverlay = () => {
    if (phase === 'idle') start()
    else if (phase === 'done') navigate(result ? '/race/results' : '/race')
  }

  const controls = (cls: string) => (
    <div className={cls}>
      <button className="lv-brake" data-braking={view.braking} disabled={phase !== 'race'}
        onPointerDown={e => { e.preventDefault(); press() }} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        onContextMenu={e => e.preventDefault()}>Brake</button>
      <button className="lv-nitro" disabled={phase !== 'race' || view.nitroLeft === 0 || view.nitroT > 0}
        onPointerDown={e => { e.preventDefault(); nitro() }} onContextMenu={e => e.preventDefault()}>Nitro · {view.nitroLeft}</button>
    </div>
  )

  if (mobile) {
    const playing = phase === 'race' || phase === 'count'
    return (
      <div className="mshell lv-mlive">
        <div className="lv-hud-m">
          <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="Sector" v={hud.sector} />
        </div>
        <div className="lv-lanes-m">
          {stage}
          {overlay && phase !== 'idle' && phase !== 'done' && <div className="lv-overlay-m"><span style={{ color: overlay.fg }}>{overlay.big}</span></div>}
        </div>
        <div className="lv-gauges-m">
          <div><span className="label-sm">Speed</span><span className="lv-big-m tnum">{kmh(view.v)}</span><span className="lv-unit">km/h</span></div>
          <div><span className="label-sm">Gear</span><span className="lv-big-m">{gear}</span><span className="lv-unit">{view.nitroT > 0 ? 'nitro on' : `nitro ${view.nitroLeft} / ${NITRO.charges}`}</span></div>
        </div>
        {phase === 'idle' || phase === 'done'
          ? <div style={{ padding: '8px 16px 12px', flex: 'none' }}><span className="muted" style={{ fontSize: 12 }}>{overlay?.sub}</span></div>
          : <CornerCue {...approach} />}
        <div style={{ padding: '0 16px calc(16px + env(safe-area-inset-bottom))', flex: 'none' }}>
          {playing ? controls('lv-controls-m')
            : <button className="lv-shift-m" onClick={onOverlay} disabled={!overlay?.btn}>{overlay?.btn ?? overlay?.big}</button>}
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
        <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="Sector" v={hud.sector} />
      </div>
      <div className="lv-lanes">
        {stage}
        {overlay && (
          <div className="lv-overlay">
            <span className="lv-overlay-big" style={{ color: overlay.fg }}>{overlay.big}</span>
            <span style={{ fontSize: 17, color: 'var(--color-neutral-800)' }}>{overlay.sub}</span>
            {overlay.btn && <button className="btn btn-primary lv-start" onClick={onOverlay}>{overlay.btn}</button>}
          </div>
        )}
      </div>
      <CornerCue {...approach} />
      <div className="lv-bottom">
        <div className="lv-gauge"><span className="label">Speed</span><span className="lv-big tnum">{kmh(view.v)}</span><span className="lv-unit">km/h</span></div>
        <div className="lv-gauge"><span className="label">Gear</span><span className="lv-big">{gear}</span><span className="lv-unit">automatic</span></div>
        <div className="lv-gauge" style={{ gap: 12 }}>
          <div className="label" style={{ display: 'flex' }}>
            <span>Nitro</span>
            <span style={{ marginLeft: 'auto', fontWeight: 800, color: view.nitroT > 0 ? 'var(--color-accent-700)' : 'var(--color-text)' }}>{view.nitroT > 0 ? 'Boosting' : `${view.nitroLeft} / ${NITRO.charges}`}</span>
          </div>
          <div className="lv-rev" style={{ height: 48 }}>
            <span style={{ left: 0, width: `${(view.nitroT / NITRO.seconds) * 100}%`, background: 'var(--color-accent)' }} />
          </div>
          <div className="lv-rev-legend"><span>{view.braking ? 'Braking' : ' '}</span></div>
        </div>
        <div className="lv-gauge" style={{ gap: 10 }}>
          {controls('lv-controls')}
          <span className="muted" style={{ fontSize: 12 }}>Brake: hold space · Nitro: N</span>
        </div>
      </div>
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
  const drag = ev.id === 'drag'
  const best = result.rows[0].time
  const headline = won ? 'You won.' : result.place === 2 ? 'So close.' : 'Not this time.'
  const cornersList: (ShiftQuality | '—')[] = result.corners.length ? result.corners : ['—']
  const perfect = result.corners.filter(q => q === 'Perfect').length
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
          <div><span className="label">{drag ? 'Perfect shifts' : 'Perfect corners'}</span><span className="tnum">{perfect} / {result.corners.length}</span></div>
          {drag
            ? <div><span className="label">Gear reached</span><span className="tnum">{result.corners.length + 1}</span></div>
            : <div><span className="label">Nitro used</span><span className="tnum">{result.nitroUsed} / {NITRO.charges}</span></div>}
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
          <span className="label">{drag ? 'Shifts' : 'Corners'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {cornersList.map((q, i) => {
              const style = QUALITY_STYLE[q] ?? QUALITY_STYLE.Early
              return <span key={i} className="rs-shift" style={style}>{q}</span>
            })}
          </div>
        </div>
        {result.splits.length > 0 && <div className="rs-shifts">
          <span className="label">Sector times</span>
          {result.splits.map((t, i) => (
            <div key={i} className="rs-reward" style={{ padding: '6px 0' }}><span style={{ fontSize: 14 }}>Sector {i + 1}</span><span className="tnum" style={{ fontSize: 16 }}>{seconds(t)}</span></div>
          ))}
        </div>}
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
