import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Lock } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { CARS_BY_ID, CATALOG, PACKS_BY_ID, TIER_RANK, makeGen, type Car, type PackId, type Tier } from '@game'
import { Aside, Main, MobileHead } from '../components/Shell'
import { EmptyState, ModelName, Photo, TIER_BAR, TIER_FG, TierFilter } from '../components/ui'
import { cr, num } from '../lib/format'
import { useIsMobile, useWipeNavigate } from '../lib/hooks'
import { animatePanel } from '../lib/motion'
import { useSnapshot } from '../state/store'
import './Garage.css'
import './Collection.css'

type Status = 'all' | 'unlocked' | 'locked'
const STATUSES: [Status, string][] = [['all', 'All'], ['unlocked', 'Unlocked'], ['locked', 'Locked']]

const ALL = [...CATALOG].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.value - a.value)

/** Every car in the game, and which of them the player owns. */
function useCollection() {
  const snap = useSnapshot()
  const owned = useMemo(() => new Set(snap.garage.map(g => g.carId)), [snap.garage])
  return { owned, ownedCount: ALL.filter(c => owned.has(c.id)).length }
}

function useFiltered(owned: Set<string>) {
  const [filter, setFilter] = useState<Tier | 'All'>('All')
  const [status, setStatus] = useState<Status>('all')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const base = useMemo(() => ALL.filter(c =>
    (status === 'all' || (status === 'unlocked') === owned.has(c.id)) &&
    (!q || `${c.make} ${c.model} ${c.gen}`.toLowerCase().includes(q))), [owned, status, q])
  const counts = useMemo(() => {
    const n = { All: base.length, Common: 0, Rare: 0, Epic: 0, Legendary: 0 } as Record<Tier | 'All', number>
    for (const c of base) n[c.tier]++
    return n
  }, [base])
  const list = useMemo(() => base.filter(c => filter === 'All' || c.tier === filter), [base, filter])
  return { list, counts, filter, setFilter, status, setStatus, query, setQuery }
}

function Tools({ status, setStatus, query, setQuery }: Pick<ReturnType<typeof useFiltered>, 'status' | 'setStatus' | 'query' | 'setQuery'>) {
  return (
    <div className="c-tools">
      <input className="input c-search" type="search" placeholder="Search make or model" aria-label="Search cars" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="bseg" role="group" aria-label="Show">
        {STATUSES.map(([v, l]) => <button key={v} aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
      </div>
    </div>
  )
}

function Header({ ownedCount, mobile }: { ownedCount: number; mobile?: boolean }) {
  const pct = Math.round((100 * ownedCount) / ALL.length)
  return (
    <div className={`g-head${mobile ? ' mobile' : ''}`}>
      <span className="g-count tnum">{String(ownedCount).padStart(3, '0')}</span>
      <span className="c-of tnum">/ {ALL.length}</span>
      <div className="g-head-text">
        <span className="g-head-title">Cars discovered</span>
        <span className="muted">{pct}% of the collection</span>
      </div>
    </div>
  )
}

function Card({ car, owned, selected, onPick, compact }: { car: Car; owned: boolean; selected: boolean; onPick: () => void; compact?: boolean }) {
  return (
    <button className={`g-card clickable${selected ? ' selected' : ''}${owned ? '' : ' locked'}`} onClick={onPick}>
      <div className="g-card-bar" style={{ background: TIER_BAR[car.tier] }} />
      <div className="c-photo">
        <Photo car={car} className="g-card-photo" gray={!owned} lazy />
        {!owned && <span className="c-lock" aria-label="Locked"><Lock size={compact ? 12 : 14} /></span>}
      </div>
      <div className="g-card-body">
        <div className="g-card-kicker">
          <span className="g-card-make">{car.make}</span>
          <span style={{ color: TIER_FG[car.tier], fontWeight: 600 }}>{car.tier}</span>
        </div>
        <span className="g-card-model"><ModelName car={car} /></span>
        <span className="g-card-meta tnum">{car.year} · {car.hp} hp{owned ? ' · In garage' : ''}</span>
      </div>
    </button>
  )
}

function Panel({ car, owned, animateRef, page }: { car: Car; owned: boolean; animateRef?: { current: boolean }; page?: boolean }) {
  const navigate = useWipeNavigate()
  const back = useNavigate()
  const hdr = useRef<HTMLDivElement>(null), title = useRef<HTMLSpanElement>(null), photo = useRef<HTMLDivElement>(null)
  const stats = useRef<HTMLDivElement>(null), meta = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!animateRef?.current && !page) return
    if (animateRef) animateRef.current = false
    animatePanel({ hdr: hdr.current, title: title.current, photo: photo.current, stats: stats.current, meta: meta.current })
  }, [car.id, animateRef, page])

  const blocks = [
    { k: 'Power', v: car.hp, u: 'hp', pct: car.hp / 650 },
    { k: 'Torque', v: car.nm, u: 'Nm', pct: car.nm / 660 },
    { k: '0–100', v: car.acc.toFixed(1), u: 's', pct: (12 - car.acc) / 9 },
    { k: 'Top speed', v: car.top, u: 'km/h', pct: car.top / 390 },
  ]
  const packs = car.pools.map(p => PACKS_BY_ID[p as PackId]?.name).filter(Boolean).join(' · ')

  return (
    <div className={`g-panel${page ? ' page' : ''}`}>
      <div className="g-panel-scroll">
        <div ref={hdr} className={`red-head g-panel-head${owned ? '' : ' locked'}`}>
          <div className="kicker">
            {page && (
              <button className="btn btn-icon g-back" aria-label="Back" onClick={() => back('/collection')}>
                <ChevronLeft size={20} />
              </button>
            )}
            <span style={{ fontWeight: 800 }}>{car.tier}</span>
            <span>{owned ? 'In your garage' : 'Locked'}</span>
            <span style={{ marginLeft: 'auto' }}>{car.year} · {page ? car.cc : car.country}</span>
          </div>
          <span className="mk">{makeGen(car)}</span>
          <span ref={title} className="model">{car.model}</span>
        </div>
        <div ref={photo}>
          <Photo car={car} label="car photo · side profile" className="g-panel-photo" gray={!owned} />
          {car.photoCredit && <span className="photo-credit">Photo: {car.photoCredit}</span>}
        </div>
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
          <div><span className="k">Weight</span><span className="v">{num(car.kg)} kg</span></div>
          <div><span className="k">Found in</span><span className="v">{packs || '—'}</span></div>
          <div><span className="k">Value</span><span className="v">{cr(car.value)}</span></div>
        </div>
        <p className="g-blurb">{car.blurb}</p>
      </div>
      <div className="g-actions">
        {owned
          ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/garage/${car.id}`)}>View in garage</button>
          : <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/packs')}>Open a pack</button>}
      </div>
    </div>
  )
}

export function CollectionPage() {
  const mobile = useIsMobile()
  const { carId } = useParams()
  if (mobile && carId) return <CollectionDetailMobile carId={carId} />
  return mobile ? <CollectionMobile /> : <CollectionDesktop initial={carId} />
}

function CollectionDesktop({ initial }: { initial?: string }) {
  const { owned, ownedCount } = useCollection()
  const f = useFiltered(owned)
  const [sel, setSel] = useState<string | undefined>(initial)
  const animate = useRef(false)
  const current = f.list.find(c => c.id === sel) ?? f.list[0]
  return (
    <>
      <Main>
        <Header ownedCount={ownedCount} />
        <TierFilter value={f.filter} onChange={f.setFilter} counts={f.counts} />
        <Tools status={f.status} setStatus={f.setStatus} query={f.query} setQuery={f.setQuery} />
        <div className="g-scroll">
          {f.list.length ? (
            <div className="g-grid">
              {f.list.map(c => (
                <Card key={c.id} car={c} owned={owned.has(c.id)} selected={c.id === current?.id}
                  onPick={() => { if (c.id !== current?.id) { animate.current = true; setSel(c.id) } }} />
              ))}
            </div>
          ) : <p className="muted c-none">No car matches this filter.</p>}
        </div>
      </Main>
      <Aside width={440}>
        {current ? <Panel car={current} owned={owned.has(current.id)} animateRef={animate} /> : null}
      </Aside>
    </>
  )
}

function CollectionMobile() {
  const { owned, ownedCount } = useCollection()
  const f = useFiltered(owned)
  const navigate = useNavigate()
  return (
    <>
      <MobileHead title={<span className="g-brand">COLLECTION</span>} />
      <Header ownedCount={ownedCount} mobile />
      <div className="g-tiers-m"><TierFilter value={f.filter} onChange={f.setFilter} counts={f.counts} short /></div>
      <Tools status={f.status} setStatus={f.setStatus} query={f.query} setQuery={f.setQuery} />
      <div className="mscroll" style={{ padding: '12px 16px' }}>
        {f.list.length ? (
          <div className="g-grid mobile">
            {f.list.map(c => <Card key={c.id} car={c} owned={owned.has(c.id)} selected={false} compact onPick={() => navigate(`/collection/${c.id}`)} />)}
          </div>
        ) : <p className="muted c-none">No car matches this filter.</p>}
      </div>
    </>
  )
}

function CollectionDetailMobile({ carId }: { carId: string }) {
  const { owned } = useCollection()
  const car = CARS_BY_ID[carId]
  if (!car) return <EmptyState glyph="?" tone="grey" title="Unknown car." text="This car is not in the game." cta={{ label: 'Back to the collection', to: '/collection' }} />
  return <Panel car={car} owned={owned.has(car.id)} page />
}
