import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Car, Tier } from '@game'
import { TIER_BAR, TIER_FG } from '../lib/tiers'

export { TIER_BAR, TIER_FG }

/** Striped placeholder until licensed photography is in; real photos print black and white. */
export function Photo({ car, label = 'car photo', className = '', style }: { car?: Car; label?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`photo ${className}`} style={style}>
      {car?.photoUrl ? <img src={car.photoUrl} alt={`${car.make} ${car.model}`} className="grayscale" /> : <span>{label}</span>}
    </div>
  )
}

/** Model with the generation code in lighter text: "M3 E30". */
export function ModelName({ car }: { car: Car }) {
  return <>{car.model}{car.gen && <span className="gen">{car.gen}</span>}</>
}

export function TierFilter({ value, onChange, counts, short }: {
  value: Tier | 'All'
  onChange: (t: Tier | 'All') => void
  counts?: Record<Tier | 'All', number>
  short?: boolean
}) {
  const opts: (Tier | 'All')[] = ['All', 'Common', 'Rare', 'Epic', 'Legendary']
  return (
    <div className="tier-filter" role="group" aria-label="Filter by tier">
      {opts.map(t => (
        <button key={t} aria-pressed={value === t} onClick={() => onChange(t)}>
          {counts ? (
            <>
              <span className="tf-label">{short && t === 'Legendary' ? 'Legend' : t}</span>
              <span className="tf-n">{counts[t]}</span>
            </>
          ) : t}
        </button>
      ))}
    </div>
  )
}

export interface DialogProps {
  kind: string
  title: ReactNode
  rows?: [ReactNode, ReactNode][]
  note?: ReactNode
  ok: string
  onOk: () => void
  onCancel: () => void
  busy?: boolean
  children?: ReactNode
}

/** Confirm dialog: red header (kind + title), row summary, note, primary and Cancel. */
export function ConfirmDialog({ kind, title, rows = [], note, ok, onOk, onCancel, busy, children }: DialogProps) {
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="dlg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div className="dlg-head">
          <span className="kind">{kind}</span>
          <div className="title" id="dlg-title">{title}</div>
        </div>
        <div className="dlg-body">
          {children}
          {rows.map(([k, v], i) => <div className="dlg-row" key={i}><span>{k}</span><span>{v}</span></div>)}
          {note && <span className="dlg-note">{note}</span>}
        </div>
        <div className="dlg-actions">
          <button ref={okRef} className="btn btn-dark" onClick={onOk} disabled={busy}>{busy ? 'Working…' : ok}</button>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export interface EmptyStateProps {
  glyph: string
  tone?: 'dark' | 'grey' | 'red'
  title: string
  text: ReactNode
  cta: { label: string; to?: string; onClick?: () => void }
  alt?: { label: string; to?: string; onClick?: () => void }
}

const TONE = {
  dark: { background: 'var(--color-text)', color: 'var(--color-bg)' },
  grey: { background: 'var(--color-neutral-300)', color: 'var(--color-text)' },
  red: { background: 'var(--color-accent)', color: 'var(--color-bg)' },
}

function Act({ a, cls }: { a: EmptyStateProps['cta']; cls: string }) {
  return a.to ? <Link to={a.to} className={`btn ${cls}`}>{a.label}</Link> : <button className={`btn ${cls}`} onClick={a.onClick}>{a.label}</button>
}

/** Empty / error state: tone block with a glyph, title, text, primary and secondary actions. */
export function EmptyState({ glyph, tone = 'dark', title, text, cta, alt }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-glyph" style={TONE[tone]}><span>{glyph}</span></div>
      <div className="empty-body">
        <span className="t">{title}</span>
        <span className="d">{text}</span>
        <div className="acts">
          <Act a={cta} cls="btn-dark" />
          {alt && <Act a={alt} cls="btn-outline" />}
        </div>
      </div>
    </div>
  )
}
