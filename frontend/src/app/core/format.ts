export const num = (n: number) => Math.round(n).toLocaleString('en-US')
export const cr = (n: number) => `${num(n)} CR`
export const signedCr = (n: number) => `${n >= 0 ? '+' : '−'}${cr(Math.abs(n))}`

/** 2.71M, 412k, 980 */
export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return num(n)
}

export const euro = (cents: number) => `€${(cents / 100).toFixed(2)}`
export const serial = (n: number) => `#${String(n).padStart(3, '0')}`
export const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2h 14m", "38m", "1d 6h", "3d" */
export function remaining(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return `${h}h ${pad2(mm)}m`
  return `${mm}m`
}

/** "06:42:18" */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`
}

/** "12 min", "1 h", "Yesterday", "3 days" */
export function ago(at: number, now = Date.now()) {
  const m = Math.floor((now - at) / 60_000)
  if (m < 1) return 'Now'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days`
}

export const seconds = (t: number) => `${t.toFixed(2)} s`
