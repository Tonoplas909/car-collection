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
