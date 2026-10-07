import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { CARS_BY_ID, TIER_RANK, carLabel, makeGen, marketFee, type Car, type OwnedCar, type Tier } from '@game'
import { Aside, Main, MobileHead } from '../components/Shell'
import { ConfirmDialog, EmptyState, ModelName, Photo, TIER_BAR, TIER_FG, TierFilter } from '../components/ui'
import { cr, num, serial } from '../lib/format'
import { useIsMobile, useWipeNavigate } from '../lib/hooks'
import { animatePanel } from '../lib/motion'
import { actions, useSnapshot } from '../state/store'
import './Garage.css'

type Sort = 'tier' | 'hp' | 'value' | 'year'
const SORTS: [Sort, string][] = [['tier', 'Rarity'], ['hp', 'Power'], ['value', 'Value'], ['year', 'Year']]
const SORTERS: Record<Sort, (a: Item, b: Item) => number> = {
  tier: (a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.value - a.car.value,
  hp: (a, b) => b.car.hp - a.car.hp,
  value: (a, b) => b.car.value - a.car.value,
  year: (a, b) => a.car.year - b.car.year,
}

type Item = OwnedCar & { car: Car }

function useGarage() {
  const snap = useSnapshot()
  const items = useMemo(() => snap.garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(i => i.car), [snap.garage])
  const counts = useMemo(() => {
    const c = { All: items.length, Common: 0, Rare: 0, Epic: 0, Legendary: 0 } as Record<Tier | 'All', number>
    for (const i of items) c[i.car.tier]++
    return c
  }, [items])
  const total = items.reduce((a, i) => a + i.car.value, 0)
  return { items, counts, total }
}

export function GaragePage() {
  const mobile = useIsMobile()
  const { carId } = useParams()
  if (mobile && carId) return <GarageDetailMobile carId={carId} />
  return mobile ? <GarageMobile /> : <GarageDesktop initial={carId} />
}

function Sorts({ sort, onSort, compact }: { sort: Sort; onSort: (s: Sort) => void; compact?: boolean }) {
  return (
    <div className={`g-sorts${compact ? ' compact' : ''}`}>
      <span className="muted">{compact ? 'Sort' : 'Sort by'}</span>
      {SORTS.map(([v, l]) => (
        <button key={v} aria-pressed={sort === v} onClick={() => onSort(v)}>{l}</button>
      ))}
    </div>
  )
}

function CarCard({ item, selected, onPick, compact }: { item: Item; selected: boolean; onPick: () => void; compact?: boolean }) {
  const c = item.car
  return (
    <button className={`g-card clickable${selected ? ' selected' : ''}`} onClick={onPick}>
      <div className="g-card-bar" style={{ background: TIER_BAR[c.tier] }} />
      <Photo car={c} className="g-card-photo" />
      <div className="g-card-body">
        <div className="g-card-kicker">
          <span className="g-card-make">{c.make}</span>
          <span style={{ color: TIER_FG[c.tier], fontWeight: 600 }}>{c.tier}</span>
        </div>
        <span className="g-card-model"><ModelName car={c} /></span>
        <span className="g-card-meta tnum">{c.year} · {c.hp} hp{compact ? '' : ` · ${cr(c.value)}`}</span>
      </div>
    </button>
  )
}

function GarageHeader({ count, total, mobile }: { count: number; total: number; mobile?: boolean }) {
  return (
    <div className={`g-head${mobile ? ' mobile' : ''}`}>
      <span className="g-count tnum">{String(count).padStart(3, '0')}</span>
      <div className="g-head-text">
        <span className="g-head-title">Cars in garage</span>
        <span className="muted">{cr(total)} total value</span>
      </div>
    </div>
  )
}

const EMPTY = {
  glyph: '0', title: 'No cars yet.', text: 'Open your free pack or win one in a race to start your collection.',
  cta: { label: 'Open a pack', to: '/packs' }, alt: { label: 'Race', to: '/race' },
}

function GarageDesktop({ initial }: { initial?: string }) {
  const { items, counts, total } = useGarage()
  const [filter, setFilter] = useState<Tier | 'All'>('All')
  const [sort, setSort] = useState<Sort>('tier')
  const list = useMemo(() => items.filter(i => filter === 'All' || i.car.tier === filter).sort(SORTERS[sort]), [items, filter, sort])
  const [sel, setSel] = useState<string | undefined>(initial)
  const current = items.find(i => i.carId === sel) ?? [...items].sort(SORTERS.tier)[0]
  const animate = useRef(false)

  if (!items.length) {
    return <Main><GarageHeader count={0} total={0} /><EmptyState {...EMPTY} /></Main>
  }

  return (
    <>
      <Main>
        <GarageHeader count={items.length} total={total} />
        <TierFilter value={filter} onChange={setFilter} counts={counts} />
        <Sorts sort={sort} onSort={setSort} />
        <div className="g-scroll">
          <div className="g-grid">
            {list.map(i => (
              <CarCard key={i.carId} item={i} selected={i.carId === current?.carId}
                onPick={() => { if (i.carId !== current?.carId) { animate.current = true; setSel(i.carId) } }} />
            ))}
          </div>
        </div>
      </Main>
      <Aside width={440}>
        {current && <CarPanel item={current} animateRef={animate} />}
      </Aside>
    </>
  )
}

function CarPanel({ item, animateRef, page }: { item: Item; animateRef?: { current: boolean }; page?: boolean }) {
  const c = item.car
  const navigate = useWipeNavigate()
  const back = useNavigate()
  const [selling, setSelling] = useState(false)
  const hdr = useRef<HTMLDivElement>(null), title = useRef<HTMLSpanElement>(null), photo = useRef<HTMLDivElement>(null)
  const stats = useRef<HTMLDivElement>(null), meta = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!animateRef?.current && !page) return
    if (animateRef) animateRef.current = false
    animatePanel({ hdr: hdr.current, title: title.current, photo: photo.current, stats: stats.current, meta: meta.current })
  }, [item.carId, animateRef, page])

  const blocks = [
    { k: 'Power', v: c.hp, u: 'hp', pct: c.hp / 650 },
    { k: 'Torque', v: c.nm, u: 'Nm', pct: c.nm / 660 },
    { k: '0–100', v: c.acc.toFixed(1), u: 's', pct: (12 - c.acc) / 9 },
    { k: 'Top speed', v: c.top, u: 'km/h', pct: c.top / 390 },
  ]

  const race = () => { actions.setRace({ carId: item.carId }); navigate('/race') }

  return (
    <div className={`g-panel${page ? ' page' : ''}`}>
      <div className="g-panel-scroll">
        <div ref={hdr} className="red-head g-panel-head">
          <div className="kicker">
            {page && (
              <button className="btn btn-icon g-back" aria-label="Back" onClick={() => back('/garage')}>
                <ChevronLeft size={20} />
              </button>
            )}
            <span style={{ fontWeight: 800 }}>{c.tier}</span>
            <span>{serial(item.serial)}</span>
            <span style={{ marginLeft: 'auto' }}>{c.year} · {page ? c.cc : c.country}</span>
          </div>
          <span className="mk">{makeGen(c)}</span>
          <span ref={title} className="model">{c.model}</span>
        </div>
        <div ref={photo}><Photo car={c} label="car photo · side profile" className="g-panel-photo" />{c.photoCredit && <span className="photo-credit">Photo: {c.photoCredit}</span>}</div>
        <div ref={stats} className="split g-stats">
          {blocks.map(s => (
            <div className="stat" key={s.k}>
              <span className="label">{s.k}</span>
              <span className="v">{s.v}<span className="u">{s.u}</span></span>
              <div className="statbar"><div className="statbar-fill" style={{ width: `${Math.max(0, Math.min(100, Math.round(s.pct * 100)))}%` }} /></div>
            </div>
          ))}
        </div>
        <div ref={meta} className="meta3 hair-b">
          <div><span className="k">Weight</span><span className="v">{num(c.kg)} kg</span></div>
          <div><span className="k">Upgrade</span><span className="v">Lv {item.level} / 5</span></div>
          <div><span className="k">{page ? 'Value' : 'Market value'}</span><span className="v">{cr(c.value)}</span></div>
        </div>
        <p className="g-blurb">{c.blurb}</p>
      </div>
      <div className="g-actions">
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={race}>Race</button>
        <button className="btn btn-secondary" onClick={() => navigate(`/upgrade/${item.carId}`)}>Upgrade</button>
        <button className="btn btn-secondary" onClick={() => setSelling(true)}>Sell</button>
      </div>
      {selling && <SellDialog car={c} onClose={() => setSelling(false)} onDone={() => navigate('/market?tab=mine')} />}
    </div>
  )
}

export function SellDialog({ car, onClose, onDone }: { car: Car; onClose: () => void; onDone: () => void }) {
  const [price, setPrice] = useState(String(Math.round(car.value * 1.04 / 100) * 100))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const p = Math.max(0, Math.round(Number(price) || 0))
  const submit = async () => {
    setBusy(true); setError('')
    try { await actions.listCar(car.id, p); onClose(); onDone() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <ConfirmDialog kind="Confirm listing" title={`List ${carLabel(car)} for ${cr(p)}?`}
      rows={[['Last sale', cr(car.value)], ['Your price', cr(p)], ['Market fee 5%', cr(marketFee(p))], ['You receive', cr(p - marketFee(p))]]}
      note={error ? <span className="err">{error}</span> : 'The car leaves your garage while it is listed. You can cancel any time.'}
      ok="List car" onOk={submit} onCancel={onClose} busy={busy}>
      <div className="field" style={{ paddingBottom: 8 }}>
        <label htmlFor="sell-price">Price (CR)</label>
        <input id="sell-price" className="input tnum" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
      </div>
    </ConfirmDialog>
  )
}

function GarageMobile() {
  const { items, counts, total } = useGarage()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Tier | 'All'>('All')
  const [sort, setSort] = useState<Sort>('tier')
  const list = useMemo(() => items.filter(i => filter === 'All' || i.car.tier === filter).sort(SORTERS[sort]), [items, filter, sort])
  return (
    <>
      <MobileHead title={<span className="g-brand">MARQUE</span>} />
      <GarageHeader count={items.length} total={total} mobile />
      {items.length ? (
        <>
          <div className="g-tiers-m"><TierFilter value={filter} onChange={setFilter} counts={counts} short /></div>
          <Sorts sort={sort} onSort={setSort} compact />
          <div className="mscroll" style={{ padding: '12px 16px' }}>
            <div className="g-grid mobile">
              {list.map(i => <CarCard key={i.carId} item={i} selected={false} compact onPick={() => navigate(`/garage/${i.carId}`)} />)}
            </div>
          </div>
        </>
      ) : <EmptyState {...EMPTY} />}
    </>
  )
}

function GarageDetailMobile({ carId }: { carId: string }) {
  const { items } = useGarage()
  const item = items.find(i => i.carId === carId)
  if (!item) return <EmptyState glyph="?" tone="grey" title="Not in your garage." text="This car is not in your collection." cta={{ label: 'Back to garage', to: '/garage' }} />
  return <CarPanel item={item} page />
}
