import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DT, DragSim, GEARS, MAX_RACE_SECONDS, SHIFT_BANDS, opponentTraces, raceSpec, shiftQuality, type Car, type RaceEvent, type ShiftQuality } from '@game'
import type { RaceResult } from '../api'
import { Hud } from '../components/Hud'
import { ModelName, TIER_BAR } from '../components/ui'
import { seconds } from '../lib/format'
import { useIsMobile, useWipeNavigate } from '../lib/hooks'
import { actions } from '../state/store'
import './DragRace.css'

type Phase = 'idle' | 'count' | 'race' | 'submitting' | 'done'

/** Colour of the rev bar's fill for the band the revs are in right now */
const FILL: Record<ShiftQuality, string> = {
  Early: 'var(--color-text)', OK: 'var(--color-neutral-700)', Great: 'var(--color-accent-600)', Perfect: 'var(--color-accent)', Late: 'var(--color-neutral-500)',
}
/** The rev bar shows revs from this value to 1, so the shift window stays wide enough to aim at */
const REV_FROM = 0.4
const at = (rpm: number) => Math.min(1, Math.max(0, (rpm - REV_FROM) / (1 - REV_FROM)))

/** The bands around the middle of the window, from the left edge to the right edge, with the label to show in each */
const { center: C, perfect: P, great: G, ok: O } = SHIFT_BANDS
const BANDS = [
  { from: C - O, to: C - G, label: 'OK', fill: 'var(--color-neutral-300)', minor: true },
  { from: C - G, to: C - P, label: 'GREAT', fill: 'var(--color-neutral-500)', minor: true },
  { from: C - P, to: C + P, label: 'PERFECT', fill: 'var(--color-accent-300)', minor: false },
  { from: C + P, to: C + G, label: 'GREAT', fill: 'var(--color-neutral-500)', minor: true },
  { from: C + G, to: Math.min(1, C + O), label: 'OK', fill: 'var(--color-neutral-300)', minor: true },
]

interface View {
  t: number; d: number; v: number; gear: number; rpm: number; quality: ShiftQuality | null
}

/** The drag strip: a straight quarter mile where the player shifts up in the rev window. */
export function DragRace({ raceId, car, level, ev }: { raceId: string; car: Car; level: number; ev: RaceEvent }) {
  const mobile = useIsMobile()
  const navigate = useWipeNavigate()
  const [sim] = useState(() => new DragSim(raceSpec(car, level)))
  const traces = useMemo(() => opponentTraces(raceId, car, ev.id), [raceId, car, ev.id])
  const shifts = useRef<number[]>([])
  const phaseRef = useRef<Phase>('idle')
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const read = useCallback((quality: View['quality'] = null): View => {
    const s = sim.s
    return { t: s.t, d: Math.min(ev.len, s.d), v: s.v, gear: s.gear, rpm: s.rpm, quality }
  }, [sim, ev.len])
  const [view, setView] = useState<View>(() => read())
  const [result, setResult] = useState<RaceResult | null>(null)
  const [error, setError] = useState('')
  const raf = useRef(0)

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const finish = useCallback(async () => {
    go('submitting')
    try {
      const r = await actions.finishRace({ brake: [], nitro: [], shift: shifts.current })
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
        setView(v => read(v.quality))
        if (over()) { void finish(); return }
      }
      if (phaseRef.current === 'count' || phaseRef.current === 'race') raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [sim, read, finish])

  const shift = useCallback(() => {
    if (phaseRef.current !== 'race') return
    const step = sim.s.step
    const q = sim.shift()
    if (!q) return
    shifts.current.push(step)
    setView(read(q))
  }, [sim, read])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (phaseRef.current !== 'count' && phaseRef.current !== 'race') return
      e.preventDefault()
      if (!e.repeat) shift()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf.current) }
  }, [shift])

  const racing = phase === 'race' || phase === 'submitting' || phase === 'done'
  const tNow = racing ? view.t : 0
  const lanes = [
    { name: 'You', car: `${car.make} ${car.model}`, d: view.d, me: true, bar: TIER_BAR[car.tier] },
    ...traces.map(o => ({ name: o.name, car: o.car, d: o.distanceAt(tNow), me: false, bar: 'var(--color-neutral-500)' })),
  ]
  const pos = [...lanes].sort((a, b) => b.d - a.d).findIndex(l => l.me) + 1
  const ticks = Array.from({ length: Math.ceil(ev.len / 100) - 1 }, (_, i) => ((i + 1) * 100) / ev.len * 100)
  const rpmBg = FILL[shiftQuality(view.rpm)]
  const hud = { pos: phase === 'idle' || phase === 'count' ? '—' : `${result?.place ?? pos} / 4`, time: seconds(tNow), togo: `${Math.max(0, Math.round(ev.len - view.d))} m` }

  const overlay = phase === 'idle' ? { big: 'Ready', sub: 'Shift up when the revs enter the grey window: space bar or the button. A perfect shift gives a short boost.', fg: 'var(--color-text)', btn: 'Start race' }
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
  const hint = phase === 'idle' || phase === 'done' ? overlay?.sub : view.quality ? `${view.quality} shift` : 'Shift in the marked window'

  if (mobile) {
    const playing = phase === 'race' || phase === 'count'
    return (
      <div className="mshell dg-mlive">
        <div className="lv-hud-m">
          <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="To go" v={hud.togo} />
        </div>
        <div className="dg-lanes-m">
          {lanes.map(l => {
            const p = Math.min(100, (l.d / ev.len) * 100)
            return (
              <div key={l.name} className={`dg-lane-m${l.me ? ' me' : ''}`}>
                <span className="dg-lane-name">{l.name}</span>
                <span className="dg-finish" />
                <div className="dg-track-m">
                  <div className="dg-chip" style={{ left: `${p}%`, transform: `translate(-${p}%, -50%)` }}>
                    <span style={{ width: 6, height: 30, background: l.me ? 'var(--color-accent)' : l.bar }} />
                    <span className="dg-chip-label" style={{ height: 30, fontSize: 12 }}>{l.me ? `YOU · ${Math.round(l.d)} m` : `${Math.round(l.d)} m`}</span>
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
          <Legend />
          <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
        </div>
        <div style={{ padding: '0 16px calc(16px + env(safe-area-inset-bottom))', flex: 'none' }}>
          {playing
            ? <button className="lv-shift-m" onPointerDown={e => { e.preventDefault(); shift() }} disabled={phase !== 'race' || view.gear >= GEARS}>Shift up</button>
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
        <Hud k="Position" v={hud.pos} /><Hud k="Time" v={hud.time} /><Hud k="To go" v={hud.togo} />
      </div>
      <div className="dg-lanes">
        {lanes.map(l => {
          const p = Math.min(100, (l.d / ev.len) * 100)
          return (
            <div key={l.name} className={`dg-lane${l.me ? ' me' : ''}`}>
              <div className="dg-who"><span style={{ fontWeight: 800, fontSize: 15 }}>{l.name}</span><span className="muted" style={{ fontSize: 12 }}>{l.car}</span></div>
              <div className="dg-track">
                {ticks.map(t => <span key={t} className="dg-tick" style={{ left: `${t}%` }} />)}
                <span className="dg-line" />
                <div className="dg-chip" style={{ left: `${p}%`, transform: `translate(-${p}%, -50%)` }}>
                  <span style={{ width: 6, height: 36, background: l.bar }} />
                  <span className="dg-chip-label tnum">{l.me ? `YOU · ${Math.round(l.d)} m` : `${Math.round(l.d)} m`}</span>
                </div>
              </div>
            </div>
          )
        })}
        {overlay && (
          <div className="lv-overlay">
            <span className="lv-overlay-big" style={{ color: overlay.fg }}>{overlay.big}</span>
            <span style={{ fontSize: 17, color: 'var(--color-neutral-800)' }}>{overlay.sub}</span>
            {overlay.btn && <button className="btn btn-primary lv-start" onClick={onOverlay}>{overlay.btn}</button>}
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
          <Legend />
        </div>
        <div className="lv-gauge" style={{ gap: 10 }}>
          <button className="btn btn-primary dg-shift" onPointerDown={e => { e.preventDefault(); shift() }} disabled={phase !== 'race' || view.gear >= GEARS}>Shift up</button>
          <span className="muted" style={{ fontSize: 12 }}>or press the space bar</span>
        </div>
      </div>
    </div>
  )
}

function RevBar({ rpm, bg, height }: { rpm: number; bg: string; height: number }) {
  return (
    <div className="lv-rev" style={{ height }}>
      {BANDS.map((b, i) => <span key={i} style={{ left: `${at(b.from) * 100}%`, width: `${(at(b.to) - at(b.from)) * 100}%`, background: b.fill }} />)}
      <span style={{ left: 0, width: `${at(rpm) * 100}%`, background: bg }} />
    </div>
  )
}

/** Names the bands under the rev bar */
function Legend() {
  return (
    <div className="dg-legend" aria-hidden="true">
      {BANDS.map((b, i) => <span key={i} className={b.minor ? 'dg-minor' : undefined} style={{ left: `${((at(b.from) + at(b.to)) / 2) * 100}%` }}>{b.label}</span>)}
    </div>
  )
}
