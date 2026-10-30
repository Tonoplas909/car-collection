import { describe, expect, it } from 'vitest'
import { DRAG_TRACK, TRACKS, isCorner, layoutTrack, nextCorner, pointAt, sectorIndexAt, sectorStarts, trackLength, type TrackId } from './tracks.ts'

const ids = Object.keys(TRACKS) as TrackId[]

describe('circuits', () => {
  it('has the three circuits, and the drag strip apart', () => {
    expect(ids.sort()).toEqual(['run', 'sprint', 'touge'])
    expect(DRAG_TRACK.id).toBe('drag')
    expect(trackLength(DRAG_TRACK)).toBe(402)
    expect(DRAG_TRACK.sectors.some(isCorner)).toBe(false)
  })

  it('every circuit has 6 to 8 sectors and sane corner speeds', () => {
    for (const id of ids) {
      const t = TRACKS[id]
      expect(t.id).toBe(id)
      expect(t.sectors.length).toBeGreaterThanOrEqual(6)
      expect(t.sectors.length).toBeLessThanOrEqual(8)
      for (const s of t.sectors.filter(isCorner)) {
        expect(s.vRef!).toBeGreaterThanOrEqual(12)
        expect(s.vRef!).toBeLessThanOrEqual(90)
      }
      expect(t.sectors.some(isCorner)).toBe(true)
    }
  })

  it('declares what each circuit rewards', () => {
    expect(DRAG_TRACK.focus).toEqual(['accel'])
    expect(TRACKS.touge.focus).toEqual(['grip'])
    expect(TRACKS.run.focus).toEqual(['top'])
    expect([...TRACKS.sprint.focus].sort()).toEqual(['accel', 'grip', 'top'])
  })

  it('measures length and sector starts', () => {
    for (const id of ids) {
      const t = TRACKS[id]
      expect(trackLength(t)).toBe(t.sectors.reduce((a, s) => a + s.len, 0))
      const starts = sectorStarts(t)
      expect(starts[0]).toBe(0)
      expect(starts).toHaveLength(t.sectors.length)
      starts.forEach((d, i) => { if (i) expect(d).toBeGreaterThan(starts[i - 1]) })
    }
  })

  it('finds the sector at a distance, clamped at both ends', () => {
    const t = TRACKS.sprint
    const starts = sectorStarts(t)
    expect(sectorIndexAt(t, 0)).toBe(0)
    expect(sectorIndexAt(t, -5)).toBe(0)
    expect(sectorIndexAt(t, starts[1] - 0.001)).toBe(0)
    expect(sectorIndexAt(t, starts[1])).toBe(1)
    expect(sectorIndexAt(t, trackLength(t) + 50)).toBe(t.sectors.length - 1)
  })

  it('lays the circuit out from the origin', () => {
    for (const id of ids) {
      const t = TRACKS[id]
      const pts = layoutTrack(t)
      expect(pts).toHaveLength(Math.ceil(trackLength(t) / 10) + 1)
      expect(pts[0]).toEqual({ x: 0, y: 0 })
      expect(pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
    expect(layoutTrack(TRACKS.touge, 25)).toHaveLength(Math.ceil(trackLength(TRACKS.touge) / 25) + 1)
  })

  it('interpolates a point along the layout', () => {
    const pts = layoutTrack(TRACKS.run)
    expect(pointAt(pts, 10, 0)).toEqual(pts[0])
    const mid = pointAt(pts, 10, 15)
    expect(mid.x).toBeCloseTo((pts[1].x + pts[2].x) / 2)
    expect(mid.y).toBeCloseTo((pts[1].y + pts[2].y) / 2)
    expect(pointAt(pts, 10, 1e9)).toEqual(pts[pts.length - 1])
  })

  it('finds the corner to brake for, including the one right after the corner you are in', () => {
    const t = TRACKS.touge
    const starts = sectorStarts(t)
    // On the opening straight: the first hairpin, however far it is
    expect(nextCorner(t, 0, 0)).toEqual({ index: 1, dist: starts[1] })
    // In the chicane (sector 3), 20 m from its end: the hairpin that follows it
    expect(nextCorner(t, 3, starts[4] - 20)).toEqual({ index: 4, dist: 20 })
    // In the first hairpin, the chicane is still more than 200 m away: nothing to show yet
    expect(nextCorner(t, 1, starts[1] + 10)).toBeNull()
    // Past the last corner there is nothing left to brake for
    expect(nextCorner(t, 7, starts[7] + 5)).toBeNull()
    // On a straight with no corner after it
    expect(nextCorner(TRACKS.sprint, TRACKS.sprint.sectors.length - 1, trackLength(TRACKS.sprint) - 100)).toBeNull()
  })
})
