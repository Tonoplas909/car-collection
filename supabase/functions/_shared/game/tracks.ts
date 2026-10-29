// Circuits for the races: a list of sectors per event. Corner sectors carry a reference corner speed
// (`vRef`, m/s) that a car's grip scales; the simulation lives in circuit.ts.

export type TrackId = 'drag' | 'sprint' | 'touge' | 'run'
export type SectorKind = 'straight' | 'sweeper' | 'chicane' | 'hairpin' | 'climb'
/** The car notes a circuit rewards. */
export type Focus = 'accel' | 'grip' | 'top'

export interface Sector {
  kind: SectorKind
  /** metres */
  len: number
  /** Heading change over the sector, degrees (positive = left); 0 on a straight */
  turn: number
  /** Reference corner speed, m/s. Only corner sectors have one. */
  vRef?: number
  /** Slope, 0.06 = 6 % uphill. Takes 9.81 · grade m/s² off the acceleration. */
  grade?: number
}

export interface Track {
  id: TrackId
  focus: Focus[]
  sectors: Sector[]
}

export const TRACKS: Record<TrackId, Track> = {
  // Santa Pod: launches out of two hard stops.
  drag: {
    id: 'drag',
    focus: ['accel'],
    sectors: [
      { kind: 'straight', len: 300, turn: 0 },
      { kind: 'hairpin', len: 70, turn: 180, vRef: 15 },
      { kind: 'straight', len: 280, turn: 0 },
      { kind: 'chicane', len: 90, turn: -35, vRef: 24 },
      { kind: 'straight', len: 320, turn: 0 },
      { kind: 'hairpin', len: 80, turn: -170, vRef: 16 },
      { kind: 'straight', len: 400, turn: 0 },
    ],
  },
  // Suzuka East: a bit of everything.
  sprint: {
    id: 'sprint',
    focus: ['accel', 'grip', 'top'],
    sectors: [
      { kind: 'straight', len: 320, turn: 0 },
      { kind: 'sweeper', len: 150, turn: 60, vRef: 42 },
      { kind: 'straight', len: 260, turn: 0 },
      { kind: 'chicane', len: 110, turn: -40, vRef: 26 },
      { kind: 'straight', len: 230, turn: 0 },
      { kind: 'hairpin', len: 90, turn: 170, vRef: 17 },
      { kind: 'straight', len: 340, turn: 0 },
    ],
  },
  // Mountain pass: tight, uphill, nothing to gain from top speed.
  touge: {
    id: 'touge',
    focus: ['grip'],
    sectors: [
      { kind: 'straight', len: 120, turn: 0 },
      { kind: 'hairpin', len: 90, turn: 170, vRef: 15 },
      { kind: 'climb', len: 160, turn: 20, grade: 0.06 },
      { kind: 'chicane', len: 110, turn: -40, vRef: 22 },
      { kind: 'hairpin', len: 90, turn: -175, vRef: 14 },
      { kind: 'sweeper', len: 150, turn: 70, vRef: 30 },
      { kind: 'straight', len: 110, turn: 0 },
      { kind: 'hairpin', len: 80, turn: 165, vRef: 14 },
    ],
  },
  // Closed autobahn section: long straights, fast sweepers.
  run: {
    id: 'run',
    focus: ['top'],
    sectors: [
      { kind: 'straight', len: 600, turn: 0 },
      { kind: 'sweeper', len: 200, turn: 45, vRef: 76 },
      { kind: 'straight', len: 600, turn: 0 },
      { kind: 'chicane', len: 120, turn: 30, vRef: 34 },
      { kind: 'straight', len: 450, turn: 0 },
      { kind: 'sweeper', len: 200, turn: -45, vRef: 72 },
      { kind: 'straight', len: 350, turn: 0 },
    ],
  },
}

export const trackLength = (t: Track) => t.sectors.reduce((a, s) => a + s.len, 0)

export const isCorner = (s: Sector) => s.vRef !== undefined

/** Distance at which each sector starts. */
export function sectorStarts(t: Track): number[] {
  const out: number[] = []
  let d = 0
  for (const s of t.sectors) { out.push(d); d += s.len }
  return out
}

/** Index of the sector at distance `d`, clamped to the first and last sector. */
export function sectorIndexAt(t: Track, d: number): number {
  const starts = sectorStarts(t)
  let i = 0
  while (i + 1 < starts.length && starts[i + 1] <= d) i++
  return i
}

/**
 * The corner to brake for next: the first corner after sector `sector`, and how far it is. From inside a corner
 * it only counts once it is within `windowM`, so the cue for a hairpin right after a chicane shows up early.
 */
export function nextCorner(t: Track, sector: number, d: number, windowM = 200): { index: number; dist: number } | null {
  const index = t.sectors.findIndex((s, i) => i > sector && isCorner(s))
  if (index < 0) return null
  const dist = sectorStarts(t)[index] - d
  return isCorner(t.sectors[sector]) && dist > windowM ? null : { index, dist }
}

export interface Point { x: number; y: number }

/** Points every `stepM` metres along the circuit, ending at the finish. Heading starts along +x. */
export function layoutTrack(t: Track, stepM = 10): Point[] {
  const length = trackLength(t)
  const starts = sectorStarts(t)
  const heading = (d: number) => {
    let deg = 0
    t.sectors.forEach((s, i) => { deg += s.turn * Math.min(1, Math.max(0, (d - starts[i]) / s.len)) })
    return (deg * Math.PI) / 180
  }
  const pts: Point[] = [{ x: 0, y: 0 }]
  const n = Math.ceil(length / stepM)
  for (let i = 1; i <= n; i++) {
    const d0 = (i - 1) * stepM, d1 = Math.min(i * stepM, length)
    const h = heading((d0 + d1) / 2)
    const p = pts[i - 1]
    pts.push({ x: p.x + Math.cos(h) * (d1 - d0), y: p.y + Math.sin(h) * (d1 - d0) })
  }
  return pts
}

/** Position at distance `d` along a layout made with the same `stepM`. */
export function pointAt(points: Point[], stepM: number, d: number): Point {
  const i = d / stepM
  if (i <= 0) return points[0]
  if (i >= points.length - 1) return points[points.length - 1]
  const lo = Math.floor(i), f = i - lo
  const a = points[lo], b = points[lo + 1]
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
