import { describe, expect, it } from 'vitest'
import { TRACKS, isCorner, layoutTrack, pointAt, sectorIndexAt, sectorStarts, trackLength, type TrackId } from './tracks.ts'

const ids = Object.keys(TRACKS) as TrackId[]

describe('circuits', () => {
  it('has the four events', () => {
    expect(ids.sort()).toEqual(['drag', 'run', 'sprint', 'touge'])
  })

  it('every circuit has 6 to 8 sectors and sane corner speeds', () => {
    for (const id of ids) {
      const t = TRACKS[id]
      expect(t.id).toBe(id)
      expect(t.sectors.length).toBeGreaterThanOrEqual(6)
      expect(t.sectors.length).toBeLessThanOrEqual(8)
      for (const s of t.sectors.filter(isCorner)) {
        expect(s.vRef!).toBeGreaterThanOrEqual(12)
        expect(s.vRef!).toBeLessThanOrEqual(60)
      }
      expect(t.sectors.some(isCorner)).toBe(true)
    }
  })

  it('declares what each circuit rewards', () => {
    expect(TRACKS.drag.focus).toEqual(['accel'])
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
})
