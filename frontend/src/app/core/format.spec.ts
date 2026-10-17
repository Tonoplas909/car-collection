import { clock, compact, cr, remaining, signedCr } from './format'

describe('format', () => {
  it('formats credits', () => {
    expect(cr(48200)).toBe('48,200 CR')
    expect(signedCr(-1500)).toBe('−1,500 CR')
    expect(compact(2_710_000)).toBe('2.71M')
    expect(compact(412_000)).toBe('412k')
  })

  it('formats durations', () => {
    expect(remaining(2 * 3_600_000 + 14 * 60_000)).toBe('2h 14m')
    expect(remaining(30 * 3_600_000)).toBe('1d 6h')
    expect(clock(6 * 3_600_000 + 42 * 60_000 + 18_000)).toBe('06:42:18')
  })
})
