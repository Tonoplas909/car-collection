import { useMemo } from 'react'
import { isCorner, layoutTrack, pointAt, sectorStarts, type Track } from '@game'

const STEP = 10

export interface MapDot {
  id: string
  /** Distance along the circuit, metres */
  d: number
  me: boolean
}

const toPoints = (ps: { x: number; y: number }[]) => ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** The circuit seen from above, corners drawn thicker, with one dot per driver. */
export function RaceMap({ track, dots = [], size = 'lg' }: { track: Track; dots?: MapDot[]; size?: 'sm' | 'lg' }) {
  const geo = useMemo(() => {
    const pts = layoutTrack(track, STEP)
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY
    const span = Math.max(w, h, 1)
    const pad = span * 0.1
    const starts = sectorStarts(track)
    const corners = track.sectors.flatMap((s, i) => (isCorner(s)
      ? [{ i, pts: pts.filter((_, k) => k * STEP >= starts[i] - STEP && k * STEP <= starts[i] + s.len + STEP) }]
      : []))
    return { pts, corners, span, box: `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}` }
  }, [track])
  const r = geo.span * (size === 'sm' ? 0.028 : 0.02)
  const end = geo.pts[geo.pts.length - 1]
  const ordered = [...dots].sort((a, b) => Number(a.me) - Number(b.me))
  return (
    <svg className={`rmap rmap-${size}`} viewBox={geo.box} role="img" aria-label="Circuit map" preserveAspectRatio="xMidYMid meet">
      <polyline className="rmap-road" points={toPoints(geo.pts)} />
      {geo.corners.map(c => <polyline key={c.i} className="rmap-corner" points={toPoints(c.pts)} />)}
      <rect className="rmap-finish" x={end.x - r} y={end.y - r} width={r * 2} height={r * 2} />
      {ordered.map(dot => {
        const p = pointAt(geo.pts, STEP, dot.d)
        return <circle key={dot.id} className={`rmap-dot${dot.me ? ' me' : ''}`} cx={p.x} cy={p.y} r={dot.me ? r * 1.3 : r} />
      })}
    </svg>
  )
}

const WINDOW = 200
const BOARDS = [100, 50, 25]
const kmh = (v: number) => Math.round(v * 3.6)

/**
 * The next 200 m of road with the corner at its end and braking boards at 100, 50 and 25 m before it.
 * `dist` is null when there is no corner ahead; `note` then says what to do instead.
 */
export function ApproachStrip({ label, dist, target, v, note }: { label: string; dist: number | null; target: number; v: number; note: string }) {
  const hot = dist !== null && v > target * 1.05
  const pct = (m: number) => `${Math.min(100, Math.max(0, (m / WINDOW) * 100))}%`
  return (
    <div className="ap" data-hot={hot}>
      <div className="ap-bar">
        {dist !== null && BOARDS.map(b => {
          const at = dist - b
          return at > WINDOW ? null : <span key={b} className={`ap-board${at <= 0 ? ' passed' : ''}`} style={{ left: pct(at) }}>{b}</span>
        })}
        {dist !== null && dist <= WINDOW && <span className="ap-corner" style={{ left: pct(dist) }} />}
      </div>
      <div className="ap-text">
        {dist === null ? note : <><b>{label}</b> in {Math.max(0, Math.round(dist))} m · target {kmh(target)} km/h · you {kmh(v)} km/h{hot ? ' · too fast' : ''}</>}
      </div>
    </div>
  )
}
