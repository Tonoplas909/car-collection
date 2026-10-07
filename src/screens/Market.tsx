import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CARS_BY_ID, TIER_RANK, carLabel, makeGen, marketFee, type Car, type Tier } from '@game'
import type { Listing, SwapOffer } from '../api'
import { Aside, Main, MobileHead } from '../components/Shell'
import { ConfirmDialog, EmptyState, ModelName, Photo, TIER_BAR, TIER_FG, TierFilter } from '../components/ui'
import { compact, cr, num, remaining } from '../lib/format'
import { useIsMobile, useNow, useWipeNavigate } from '../lib/hooks'
import { animatePanel } from '../lib/motion'
import { actions, useSnapshot } from '../state/store'
import { SellDialog } from './Garage'
import './Market.css'

type Tab = 'buy' | 'sell' | 'mine' | 'offers'
type Sort = 'tier' | 'priceDesc' | 'priceAsc' | 'name'
const TABS: [Tab, string][] = [['buy', 'Buy'], ['sell', 'Sell'], ['mine', 'My listings'], ['offers', 'Offers']]
const SORTERS: Record<Sort, (a: Row, b: Row) => number> = {
  tier: (a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.price - a.price,
  priceDesc: (a, b) => b.price - a.price,
  priceAsc: (a, b) => a.price - b.price,
  name: (a, b) => a.car.model.localeCompare(b.car.model),
}

type Row = Listing & { car: Car }

/** Twelve weeks of sale prices around the 30-day average (sample until the server records sales). */
function history(l: Listing) {
  const seed = [...l.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97
  return Array.from({ length: 12 }, (_, i) => Math.round(l.avg * (0.86 + 0.24 * Math.abs(Math.sin(seed * 3.1 + i * 0.9)))))
}
const delta = (l: Listing) => Math.round((l.price / l.avg - 1) * 100)
const deltaStr = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}%`

function useRows() {
  const snap = useSnapshot()
  return useMemo(() => snap.listings.map(l => ({ ...l, car: CARS_BY_ID[l.carId] })).filter(r => r.car), [snap.listings])
}

export function MarketPage() {
  const mobile = useIsMobile()
  const { listingId } = useParams()
  if (mobile && listingId) return <ListingPageMobile id={listingId} />
  return mobile ? <MarketMobile /> : <MarketDesktop />
}

/* ── Dialogs ────────────────────────────────────────────────────────── */

type DialogState =
  | { kind: 'buy'; row: Row }
  | { kind: 'offer'; row: Row }
  | { kind: 'trade'; row: Row }
  | { kind: 'swap'; offer: SwapOffer }
  | { kind: 'sell'; car: Car }
  | null

function MarketDialogs({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const snap = useSnapshot()
  const navigate = useWipeNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [give, setGive] = useState('')
  if (!state) return null

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); onClose() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const note = (text: string) => (error ? <span className="err">{error}</span> : text)
  const credits = snap.user.credits

  if (state.kind === 'sell') return <SellDialog car={state.car} onClose={onClose} onDone={() => navigate('/market?tab=mine')} />

  if (state.kind === 'buy') {
    const { row } = state
    const after = credits - row.price
    const short = after < 0
    return (
      <ConfirmDialog kind="Confirm purchase" title={`Buy ${carLabel(row.car)}?`}
        rows={[['Seller', row.seller], ['Price', cr(row.price)], ['Market fee', '0 CR'], ['Balance after', `${after < 0 ? '−' : ''}${cr(Math.abs(after))}`]]}
        note={short ? `Your balance is too low. Top up ${num(Math.ceil(-after / 1000) * 1000)} credits to continue.` : note('The car arrives in your garage at its current upgrade level.')}
        ok={short ? 'Top up credits' : 'Buy car'} busy={busy} onCancel={onClose}
        onOk={() => (short ? (onClose(), navigate('/credits')) : run(() => actions.buyListing(row.id)))} />
    )
  }

  if (state.kind === 'offer') {
    const { row } = state
    const v = Math.round(Number(amount || Math.round(row.price * 0.95)))
    return (
      <ConfirmDialog kind="Make an offer" title={`Offer on ${carLabel(row.car)}`}
        rows={[['Asking price', cr(row.price)], ['Your offer', cr(v)], ['Seller', row.seller]]}
        note={note('The seller has 24 hours to accept. Credits are only taken if they do.')} ok="Send offer" busy={busy} onCancel={onClose}
        onOk={() => run(() => actions.makeOffer(row.id, v))}>
        <div className="field" style={{ paddingBottom: 8 }}>
          <label htmlFor="offer-amount">Your offer (CR)</label>
          <input id="offer-amount" className="input tnum" inputMode="numeric" placeholder={String(Math.round(row.price * 0.95))}
            value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
      </ConfirmDialog>
    )
  }

  if (state.kind === 'trade') {
    const { row } = state
    const mine = snap.garage.map(g => CARS_BY_ID[g.carId]).filter(Boolean).sort((a, b) => b.value - a.value)
    const giveCar = CARS_BY_ID[give || mine[0]?.id]
    const add = Math.round(Number(amount) || 0)
    if (!giveCar) return <ConfirmDialog kind="Offer a trade" title="No cars to trade." note="Open a pack or win a race first." ok="Close" onOk={onClose} onCancel={onClose} />
    return (
      <ConfirmDialog kind="Confirm swap" title={`Swap ${carLabel(giveCar)} for ${carLabel(row.car)}?`}
        rows={[['You give', `${carLabel(giveCar)} · ${giveCar.tier}`], ['You get', `${carLabel(row.car)} · ${row.car.tier}`], ['Added credits', `+${cr(add)}`], ['Partner', row.seller]]}
        note={note('Both players must accept. The offer expires in 24 hours.')} ok="Send offer" busy={busy} onCancel={onClose}
        onOk={() => run(() => actions.proposeSwap({ to: row.seller, give: giveCar.id, get: row.carId, credits: add }))}>
        <div className="m-dlg-fields">
          <div className="field">
            <label htmlFor="swap-give">You give</label>
            <select id="swap-give" className="input" value={giveCar.id} onChange={e => setGive(e.target.value)}>
              {mine.map(c => <option key={c.id} value={c.id}>{c.make} {carLabel(c)} · {c.tier}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="swap-add">Add credits</label>
            <input id="swap-add" className="input tnum" inputMode="numeric" placeholder="0" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </div>
        </div>
      </ConfirmDialog>
    )
  }

  const { offer } = state
  const a = CARS_BY_ID[offer.give], b = CARS_BY_ID[offer.get]
  return (
    <ConfirmDialog kind="Confirm swap" title={`Swap ${carLabel(a)} for ${carLabel(b)}?`}
      rows={[['You give', `${carLabel(a)} · ${a.tier}`], ['You get', `${carLabel(b)} · ${b.tier}`], ['Added credits', `+${cr(offer.credits)}`], ['Partner', offer.from]]}
      note={note('Both players must accept. The offer expires in 24 hours.')} ok="Accept swap" busy={busy} onCancel={onClose}
      onOk={() => run(() => actions.acceptSwap(offer.id))} />
  )
}

/* ── Desktop (3c) ───────────────────────────────────────────────────── */

function MarketDesktop() {
  const snap = useSnapshot()
  const rows = useRows()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'buy') as Tab
  const [filter, setFilter] = useState<Tier | 'All'>('All')
  const [sort, setSort] = useState<Sort>('tier')
  const [sel, setSel] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const animate = useRef(false)
  const now = useNow(30_000)

  const buy = useMemo(() => rows.filter(r => !r.mine && (filter === 'All' || r.car.tier === filter)).sort(SORTERS[sort]), [rows, filter, sort])
  const current = buy.find(r => r.id === sel) ?? rows.find(r => r.id === sel && !r.mine) ?? buy[0]
  const live = rows.filter(r => !r.mine).length

  return (
    <>
      <Main>
        <div className="mk-head">
          <span className="page-title">Market</span>
          <div className="mk-live">
            <span className="label">Live listings</span>
            <span className="tnum">{num(live)}</span>
          </div>
        </div>
        <div className="mk-tabs" role="tablist">
          {TABS.map(([t, l]) => (
            <button key={t} role="tab" className="utab" aria-selected={tab === t} onClick={() => setParams(t === 'buy' ? {} : { tab: t })}>
              {l}{t === 'offers' && snap.offers.some(o => o.incoming) ? ` · ${snap.offers.filter(o => o.incoming).length}` : ''}
            </button>
          ))}
        </div>

        {tab === 'buy' && (
          <>
            <TierFilter value={filter} onChange={setFilter} />
            <div className="mk-scroll">
              <div className="mk-row mk-th">
                <span />
                <button onClick={() => setSort('name')}>Car</button>
                <span>Tier</span>
                <span>Upgrade</span>
                <button style={{ textAlign: 'right' }} onClick={() => setSort(sort === 'priceDesc' ? 'priceAsc' : 'priceDesc')}>
                  Price {sort === 'priceDesc' ? '↓' : sort === 'priceAsc' ? '↑' : ''}
                </button>
                <span style={{ textAlign: 'right' }}>Ends</span>
              </div>
              {buy.length ? buy.map((r, i) => {
                const ends = r.endsAt - now
                return (
                  <div key={r.id} className={`mk-row mk-tr clickable list-row${r.id === current?.id ? ' sel' : ''}`} style={{ '--i': i } as CSSProperties}
                    onClick={() => { if (r.id !== current?.id) { animate.current = true; setSel(r.id) } }}>
                    <span style={{ background: TIER_BAR[r.car.tier] }} />
                    <div className="mk-car">
                      <span className="mk-model"><ModelName car={r.car} /></span>
                      <span className="mk-sub">{r.car.make} · {r.car.year} · sold by {r.seller}</span>
                    </div>
                    <span className="mk-c" style={{ color: TIER_FG[r.car.tier], fontWeight: 600 }}>{r.car.tier}</span>
                    <span className="mk-c tnum">Lv {r.level}</span>
                    <span className="mk-c mk-price tnum">{cr(r.price)}</span>
                    <span className="mk-c tnum" style={{ textAlign: 'right', color: ends < 3_600_000 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{remaining(ends)}</span>
                  </div>
                )
              }) : (
                <EmptyState glyph="—" tone="grey" title="Nothing matches."
                  text={`No player is selling a ${filter} car right now.`}
                  cta={{ label: 'Clear filters', onClick: () => setFilter('All') }} />
              )}
            </div>
          </>
        )}
        {tab === 'sell' && <SellTab onSell={car => setDialog({ kind: 'sell', car })} />}
        {tab === 'mine' && <MineTab rows={rows.filter(r => r.mine)} now={now} />}
        {tab === 'offers' && <OffersTab onAccept={offer => setDialog({ kind: 'swap', offer })} now={now} />}
      </Main>
      <Aside width={400}>
        {tab === 'buy' && current ? (
          <ListingPanel row={current} animateRef={animate} now={now}
            onBuy={() => setDialog({ kind: 'buy', row: current })}
            onOffer={() => setDialog({ kind: 'offer', row: current })}
            onTrade={() => setDialog({ kind: 'trade', row: current })} />
        ) : <MarketInfo />}
      </Aside>
      <MarketDialogs state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}

function MarketInfo() {
  return (
    <>
      <div className="red-head">
        <span className="kicker" style={{ fontWeight: 800 }}>How selling works</span>
        <span className="model" style={{ paddingTop: 12, fontSize: 40 }}>5% fee on sale</span>
      </div>
      <div className="mk-info">
        <p>A listed car leaves your garage until it sells or you cancel. Listings run for three days.</p>
        <p>Swap offers need both players to accept and expire after 24 hours.</p>
        <p>Each listing shows twelve weeks of sale prices, so you can price against the 30-day average.</p>
      </div>
    </>
  )
}

function ListingPanel({ row, animateRef, now, onBuy, onOffer, onTrade, page }: {
  row: Row; animateRef?: { current: boolean }; now: number; onBuy: () => void; onOffer: () => void; onTrade: () => void; page?: boolean
}) {
  const snap = useSnapshot()
  const back = useNavigate()
  const hdr = useRef<HTMLDivElement>(null), title = useRef<HTMLSpanElement>(null), photo = useRef<HTMLDivElement>(null)
  const price = useRef<HTMLDivElement>(null), hist = useRef<HTMLDivElement>(null), meta = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!animateRef?.current && !page) return
    if (animateRef) animateRef.current = false
    animatePanel({ hdr: hdr.current, title: title.current, photo: photo.current, stats: price.current, hist: hist.current, meta: meta.current })
  }, [row.id, animateRef, page])

  const h = history(row), max = Math.max(...h), d = delta(row)
  const owned = snap.garage.find(g => g.carId === row.carId)
  return (
    <div className={`mk-panel${page ? ' page' : ''}`}>
      <div className="mk-panel-scroll">
        <div ref={hdr} className="red-head">
          <div className="kicker">
            {page && <button className="btn btn-icon g-back" aria-label="Back" onClick={() => back('/market')}><ChevronLeft size={20} /></button>}
            <span style={{ fontWeight: 800 }}>{row.car.tier}</span>
            <span>Lv {row.level}</span>
            <span style={{ marginLeft: 'auto' }}>{row.car.year}</span>
          </div>
          <span className="mk">{makeGen(row.car)}</span>
          <span ref={title} className="model" style={{ fontSize: page ? 36 : 40 }}>{row.car.model}</span>
        </div>
        <div ref={photo}><Photo car={row.car} label="car photo · side profile" className="mk-photo" /></div>
        <div ref={price} className="split mk-prices">
          <div><span className="label">Buy now</span><span className="mk-big tnum">{cr(row.price)}</span></div>
          <div><span className="label">vs. 30-day avg</span><span className="mk-big tnum" style={{ color: d > 0 ? 'var(--color-accent-700)' : 'var(--color-text)' }}>{deltaStr(d)}</span></div>
        </div>
        <div className="mk-hist-wrap hair-b">
          <div className="label" style={{ display: 'flex' }}>
            <span>Sale price, last 12 weeks</span>
            <span style={{ marginLeft: 'auto' }}>avg {cr(row.avg)}</span>
          </div>
          <div ref={hist} className="mk-hist">
            {h.map((v, i) => <span key={i} style={{ height: `${Math.round((v / max) * 100)}%`, background: i === 11 ? 'var(--color-accent)' : 'var(--color-neutral-500)' }} title={cr(v)} />)}
          </div>
        </div>
        <div ref={meta} className="meta3">
          <div><span className="k">Seller</span><span className="v">{row.seller}</span></div>
          <div><span className="k">Ends in</span><span className="v">{remaining(row.endsAt - now)}</span></div>
          <div><span className="k">In your garage</span><span className="v">{owned ? `Yes · Lv ${owned.level}` : 'No'}</span></div>
        </div>
      </div>
      <div className="mk-actions">
        <button className="btn btn-primary btn-md" onClick={onBuy} disabled={!!owned}>{owned ? 'Already in your garage' : `Buy for ${cr(row.price)}`}</button>
        <div className="mk-actions-2">
          <button className="btn btn-secondary btn-md" onClick={onOffer} disabled={!!owned}>Make an offer</button>
          <button className="btn btn-secondary btn-md" onClick={onTrade}>Offer a trade</button>
        </div>
      </div>
    </div>
  )
}

function SellTab({ onSell }: { onSell: (car: Car) => void }) {
  const snap = useSnapshot()
  const cars = snap.garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car).sort((a, b) => b.car.value - a.car.value)
  if (!cars.length) return <EmptyState glyph="0" title="Nothing to sell." text="Cars you own appear here, ready to list." cta={{ label: 'Open a pack', to: '/packs' }} />
  return (
    <div className="mk-scroll">
      <div className="mk-row mk-th"><span /><span>Car</span><span>Tier</span><span>Upgrade</span><span style={{ textAlign: 'right' }}>Value</span><span /></div>
      {cars.map((x, i) => (
        <div key={x.carId} className="mk-row mk-tr list-row" style={{ '--i': i } as CSSProperties}>
          <span style={{ background: TIER_BAR[x.car.tier] }} />
          <div className="mk-car"><span className="mk-model"><ModelName car={x.car} /></span><span className="mk-sub">{x.car.make} · {x.car.year}</span></div>
          <span className="mk-c" style={{ color: TIER_FG[x.car.tier], fontWeight: 600 }}>{x.car.tier}</span>
          <span className="mk-c tnum">Lv {x.level}</span>
          <span className="mk-c mk-price tnum">{cr(x.car.value)}</span>
          <span className="mk-c" style={{ textAlign: 'right' }}><button className="btn btn-ghost" onClick={() => onSell(x.car)}>List</button></span>
        </div>
      ))}
    </div>
  )
}

function MineTab({ rows, now }: { rows: Row[]; now: number }) {
  const [busy, setBusy] = useState<string | null>(null)
  if (!rows.length) return <EmptyState glyph="—" tone="grey" title="No listings yet." text="List a car from the Sell tab or from its garage panel." cta={{ label: 'Go to garage', to: '/garage' }} />
  return (
    <div className="mk-scroll">
      <div className="mk-row mk-th"><span /><span>Car</span><span>Tier</span><span>You get</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Ends</span></div>
      {rows.map((r, i) => (
        <div key={r.id} className="mk-row mk-tr list-row" style={{ '--i': i } as CSSProperties}>
          <span style={{ background: TIER_BAR[r.car.tier] }} />
          <div className="mk-car">
            <span className="mk-model"><ModelName car={r.car} /></span>
            <span className="mk-sub">
              Lv {r.level} · <button className="mk-link" disabled={busy === r.id} onClick={async () => { setBusy(r.id); try { await actions.cancelListing(r.id) } finally { setBusy(null) } }}>Cancel listing</button>
            </span>
          </div>
          <span className="mk-c" style={{ color: TIER_FG[r.car.tier], fontWeight: 600 }}>{r.car.tier}</span>
          <span className="mk-c tnum">{compact(r.price - marketFee(r.price))}</span>
          <span className="mk-c mk-price tnum">{cr(r.price)}</span>
          <span className="mk-c tnum muted" style={{ textAlign: 'right' }}>{remaining(r.endsAt - now)}</span>
        </div>
      ))}
    </div>
  )
}

function OffersTab({ onAccept, now }: { onAccept: (o: SwapOffer) => void; now: number }) {
  const snap = useSnapshot()
  if (!snap.offers.length) return <EmptyState glyph="—" tone="grey" title="No offers." text="Swap offers you send or receive show up here for 24 hours." cta={{ label: 'Browse listings', to: '/market' }} />
  return (
    <div className="mk-scroll">
      {snap.offers.map((o, i) => {
        const a = CARS_BY_ID[o.give], b = CARS_BY_ID[o.get]
        return (
          <div key={o.id} className="mk-offer list-row" style={{ '--i': i } as CSSProperties}>
            <span style={{ background: TIER_BAR[b.tier] }} />
            <div className="mk-car">
              <span className="mk-model">{o.incoming ? `${o.from} offers ${carLabel(b)}` : `You offered ${carLabel(a)}`}</span>
              <span className="mk-sub">
                {o.incoming ? `for your ${carLabel(a)}` : `to ${o.to} for the ${carLabel(b)}`}{o.credits ? ` · +${cr(o.credits)}` : ''} · expires in {remaining(o.expiresAt - now)}
              </span>
            </div>
            {o.incoming ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-md" onClick={() => onAccept(o)}>Review</button>
                <button className="btn btn-secondary btn-md" onClick={() => actions.declineSwap(o.id)}>Decline</button>
              </div>
            ) : <span className="muted" style={{ fontSize: 13 }}>Waiting for {o.to}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ── Mobile (6b) ────────────────────────────────────────────────────── */

function MarketMobile() {
  const snap = useSnapshot()
  const rows = useRows()
  const navigate = useNavigate()
  const [seg, setSeg] = useState<'Buy' | 'Sell' | 'Swap'>('Buy')
  const [dialog, setDialog] = useState<DialogState>(null)
  const now = useNow(30_000)
  const buy = rows.filter(r => !r.mine).sort(SORTERS.tier)
  const mine = rows.filter(r => r.mine)
  const garage = snap.garage.map(g => CARS_BY_ID[g.carId]).filter(Boolean).sort((a, b) => b.value - a.value)
  return (
    <>
      <div className="m-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingBottom: 12 }}>
        <span className="m-title">Market</span>
        <div className="bseg heavy mk-seg">
          {(['Buy', 'Sell', 'Swap'] as const).map(k => <button key={k} aria-pressed={seg === k} onClick={() => setSeg(k)}>{k}</button>)}
        </div>
      </div>
      <div className="mscroll">
        {seg === 'Buy' && buy.map((r, i) => {
          const d = delta(r)
          return (
            <div key={r.id} className="mm-row clickable list-row" style={{ '--i': i } as CSSProperties} onClick={() => navigate(`/market/${r.id}`)}>
              <Photo car={r.car} label="" className="mm-thumb" />
              <div className="mm-mid">
                <span className="mm-tier" style={{ color: TIER_FG[r.car.tier] }}>{r.car.tier}</span>
                <span className="mm-model"><ModelName car={r.car} /></span>
                <span className="mm-sub">{r.seller}</span>
              </div>
              <div className="mm-right">
                <span className="tnum" style={{ fontWeight: 800, fontSize: 15 }}>{compact(r.price)}</span>
                <span style={{ fontSize: 11, color: d > 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{deltaStr(d)}</span>
              </div>
            </div>
          )
        })}
        {seg === 'Sell' && (
          <>
            {mine.map(r => (
              <div key={r.id} className="mm-row">
                <Photo car={r.car} label="" className="mm-thumb" />
                <div className="mm-mid">
                  <span className="mm-tier" style={{ color: TIER_FG[r.car.tier] }}>{r.car.tier}</span>
                  <span className="mm-model"><ModelName car={r.car} /></span>
                  <span className="mm-sub">Your listing · ends in {remaining(r.endsAt - now)}</span>
                </div>
                <div className="mm-right">
                  <span className="tnum" style={{ fontWeight: 800, fontSize: 15 }}>{compact(r.price)}</span>
                  <button className="mk-link" onClick={() => actions.cancelListing(r.id)}>Cancel</button>
                </div>
              </div>
            ))}
            <div className="label" style={{ padding: '16px 16px 6px' }}>List a car</div>
            {garage.map(c => (
              <div key={c.id} className="mm-row clickable" onClick={() => setDialog({ kind: 'sell', car: c })}>
                <Photo car={c} label="" className="mm-thumb" />
                <div className="mm-mid">
                  <span className="mm-tier" style={{ color: TIER_FG[c.tier] }}>{c.tier}</span>
                  <span className="mm-model"><ModelName car={c} /></span>
                  <span className="mm-sub">Value {cr(c.value)}</span>
                </div>
                <div className="mm-right"><span style={{ fontWeight: 800, fontSize: 13 }}>List</span></div>
              </div>
            ))}
          </>
        )}
        {seg === 'Swap' && (snap.offers.length ? snap.offers.map(o => {
          const a = CARS_BY_ID[o.give], b = CARS_BY_ID[o.get]
          return (
            <div key={o.id} className={`mm-row${o.incoming ? ' clickable' : ''}`} onClick={() => o.incoming && setDialog({ kind: 'swap', offer: o })}>
              <Photo car={b} label="" className="mm-thumb" />
              <div className="mm-mid">
                <span className="mm-tier" style={{ color: TIER_FG[b.tier] }}>{b.tier}</span>
                <span className="mm-model"><ModelName car={b} /></span>
                <span className="mm-sub">{o.incoming ? `${o.from} wants your ${carLabel(a)}` : `Offered to ${o.to}`}</span>
              </div>
              <div className="mm-right">
                <span className="tnum" style={{ fontWeight: 800, fontSize: 15 }}>{o.credits ? `+${compact(o.credits)}` : '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--color-accent-700)' }}>{remaining(o.expiresAt - now)}</span>
              </div>
            </div>
          )
        }) : <p className="muted" style={{ padding: 16 }}>No swap offers right now.</p>)}
      </div>
      <MarketDialogs state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}

function ListingPageMobile({ id }: { id: string }) {
  const rows = useRows()
  const now = useNow(30_000)
  const [dialog, setDialog] = useState<DialogState>(null)
  const row = rows.find(r => r.id === id)
  if (!row) return <><MobileHead title="Market" /><EmptyState glyph="—" tone="grey" title="Listing ended." text="This car has been sold or the listing expired." cta={{ label: 'Back to market', to: '/market' }} /></>
  return (
    <>
      <ListingPanel row={row} now={now} page
        onBuy={() => setDialog({ kind: 'buy', row })} onOffer={() => setDialog({ kind: 'offer', row })} onTrade={() => setDialog({ kind: 'trade', row })} />
      <MarketDialogs state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}
