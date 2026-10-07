import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CARS_BY_ID, DUPLICATE_CREDITS, PACKS, PACKS_BY_ID, PITY_LIMIT, TIERS, makeGen, type PackDef, type PackId } from '@game'
import { GameError } from '../api'
import { Aside, Main, MobileHead } from '../components/Shell'
import { ConfirmDialog, Photo, TIER_BAR } from '../components/ui'
import { clock, cr, num, pad2 } from '../lib/format'
import { useIsMobile, useNow, useWipeNavigate } from '../lib/hooks'
import { actions, useApp, useSnapshot } from '../state/store'
import './Packs.css'

const pct = (p: number) => `${Math.round(p * 100)}%`
const ODDS_LABELS = ['Common', 'Rare', 'Epic', 'Legend']

/** Opens a pack (or explains the shortfall) and moves to the reveal. */
function useOpenPack() {
  const navigate = useWipeNavigate()
  const [busy, setBusy] = useState<PackId | 'free' | null>(null)
  const [short, setShort] = useState<{ pack: PackDef; have: number } | null>(null)
  const [error, setError] = useState('')
  const credits = useApp(s => s.snapshot?.user.credits ?? 0)

  /** `stay`: already on the reveal screen, so just swap in the new opening. */
  const open = async (id: PackId | 'free', stay = false) => {
    if (busy) return
    if (id !== 'free' && credits < PACKS_BY_ID[id].price) { setShort({ pack: PACKS_BY_ID[id], have: credits }); return }
    setBusy(id); setError('')
    try {
      if (id === 'free') await actions.claimFreePack()
      else await actions.openPack(id)
      if (!stay) navigate('/packs/open')
      return true
    } catch (e) {
      if (e instanceof GameError && e.code === 'insufficient_credits' && id !== 'free') setShort({ pack: PACKS_BY_ID[id], have: credits })
      else setError((e as Error).message)
    } finally { setBusy(null) }
    return false
  }

  const dialog = short && (
    <ConfirmDialog kind="Low credits" title={`You need ${cr(short.pack.price)}.`}
      rows={[['Pack', `${short.pack.name} · ${cr(short.pack.price)}`], ['Your balance', cr(short.have)], ['Missing', cr(short.pack.price - short.have)]]}
      note={`The ${short.pack.name} pack costs ${num(short.pack.price)} credits. Win races or top up.`}
      ok="Top up credits" onOk={() => { setShort(null); navigate('/credits') }} onCancel={() => setShort(null)} />
  )
  return { open, busy, dialog, error }
}

export function PacksPage() {
  return useIsMobile() ? <PacksMobile /> : <PacksDesktop />
}

function PacksDesktop() {
  const snap = useSnapshot()
  const { open, busy, dialog, error } = useOpenPack()
  return (
    <>
      <Main>
        <div className="page-head">
          <span className="page-title">Packs</span>
          <span className="meta">5 cars per pack · duplicates convert to credits</span>
        </div>
        <div className="split p-shop">
          {PACKS.map(p => {
            const hero = p.id === 'apex'
            return (
              <div key={p.id} className={`p-pack${hero ? ' hero' : ''}`}>
                <div className="p-pack-kicker">
                  <span style={{ fontWeight: 800 }}>{p.kicker}</span>
                  <span style={{ marginLeft: 'auto' }}>{p.guarantee.count} {p.guarantee.tier}+</span>
                </div>
                <Photo label="pack artwork" className="p-pack-art" />
                <div className="p-pack-name">
                  <span>{p.name}</span>
                  <span className="p-pack-desc">{p.desc}</span>
                </div>
                <div className="p-odds">
                  {p.odds.map((o, i) => (
                    <div key={i}><span className="p-odds-k">{ODDS_LABELS[i]}</span><span className="p-odds-v tnum">{pct(o)}</span></div>
                  ))}
                </div>
                <button className="btn p-open" onClick={() => open(p.id)} disabled={!!busy}>
                  {busy === p.id ? 'Opening…' : `Open · ${cr(p.price)}`}
                </button>
              </div>
            )
          })}
        </div>
        {error && <p className="err" style={{ padding: '8px 24px' }}>{error}</p>}
      </Main>
      <Aside width={320}>
        <FreePack freeAt={snap.freePackAt} onClaim={() => open('free')} busy={busy === 'free'} />
        <Pity pity={snap.stats.pity} />
        <div className="p-side">
          <span className="label">Duplicate values</span>
          {TIERS.map(t => (
            <div key={t} className="p-dupe hair-b"><span>{t}</span><span className="tnum">+{cr(DUPLICATE_CREDITS[t])}</span></div>
          ))}
        </div>
      </Aside>
      {dialog}
    </>
  )
}

function FreePack({ freeAt, onClaim, busy }: { freeAt: number; onClaim: () => void; busy: boolean }) {
  const now = useNow()
  const ready = freeAt <= now
  return (
    <div className="p-side rule-b">
      <span className="label">Free daily pack</span>
      {ready ? (
        <button className="btn btn-primary btn-md" onClick={onClaim} disabled={busy}>{busy ? 'Opening…' : 'Open free Street pack'}</button>
      ) : (
        <span className="p-timer tnum">{clock(freeAt - now)}</span>
      )}
      <span className="muted" style={{ fontSize: 13 }}>One Street pack every 24 hours.</span>
    </div>
  )
}

function Pity({ pity }: { pity: number }) {
  const left = PITY_LIMIT - pity
  return (
    <div className="p-side rule-b" style={{ gap: 10 }}>
      <span className="label">Legendary guarantee</span>
      <span className="p-pity-title">Guaranteed Legendary in {left} pack{left === 1 ? '' : 's'}</span>
      <div className="p-pity">
        {Array.from({ length: PITY_LIMIT }, (_, i) => <span key={i} style={{ background: i < pity ? 'var(--color-text)' : 'var(--color-neutral-300)' }} />)}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>{pity} of {PITY_LIMIT} packs opened since your last Legendary.</span>
    </div>
  )
}

function PacksMobile() {
  const snap = useSnapshot()
  const now = useNow()
  const { open, busy, dialog, error } = useOpenPack()
  const freeReady = snap.freePackAt <= now
  return (
    <>
      <MobileHead title="Packs" />
      <div className="mscroll">
        {PACKS.map(p => {
          const hero = p.id === 'apex'
          const odds = p.odds.map((o, i) => (o ? `${['Common', 'Rare', 'Epic', 'Legendary'][i]} ${pct(o)}` : '')).filter(Boolean).join(' · ')
          return (
            <div key={p.id} className={`pm-pack${hero ? ' hero' : ''}`}>
              <Photo label="pack art" className="pm-art" />
              <div className="pm-body">
                <span className="pm-kind">{p.kicker}</span>
                <span className="pm-name">{p.name}</span>
                <span style={{ fontSize: 13 }}>{odds}</span>
                <span className="pm-foot">
                  <span className="pm-price tnum">{cr(p.price)}</span>
                  <button className="pm-open" onClick={() => open(p.id)} disabled={!!busy}>{busy === p.id ? '…' : 'Open'}</button>
                </span>
              </div>
            </div>
          )
        })}
        <div className="pm-free">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="label">Free daily pack</span>
            <span className="pm-timer tnum">{freeReady ? 'Ready' : clock(snap.freePackAt - now)}</span>
          </div>
          {freeReady && <button className="pm-open dark" onClick={() => open('free')} disabled={!!busy}>Open</button>}
        </div>
        <div className="pm-free" style={{ borderBottom: 0 }}>
          <span className="label">Legendary in {PITY_LIMIT - snap.stats.pity} packs</span>
          <span className="tnum" style={{ fontWeight: 800 }}>{snap.stats.pity} / {PITY_LIMIT}</span>
        </div>
        {error && <p className="err" style={{ padding: '0 16px' }}>{error}</p>}
      </div>
      {dialog}
    </>
  )
}

/* ── Reveal (3b desktop, 6h mobile) ─────────────────────────────────── */

export function PackRevealPage() {
  const opening = useApp(s => s.opening)
  const mobile = useIsMobile()
  const [open, setOpen] = useState<boolean[]>([false, false, false, false, false])
  const [stagger, setStagger] = useState<number[]>([])
  const [round, setRound] = useState(0)
  const { open: openPack, busy, dialog } = useOpenPack()
  if (!opening) return <Navigate to="/packs" replace />

  const pack = opening.packId === 'free' ? PACKS_BY_ID.street : PACKS_BY_ID[opening.packId]
  const done = open.every(Boolean)
  const flip = (i: number) => { setStagger([]); setOpen(o => o.map((x, k) => (k === i ? true : x))) }
  const revealAll = () => {
    let k = 0
    setStagger(open.map(o => (o ? 0 : (k++) * 260)))
    setOpen(open.map(() => true))
  }
  const newCount = opening.pulls.filter(p => !p.duplicate).length
  const anotherPack = async () => {
    if (!(await openPack(pack.id, true))) return
    setOpen([false, false, false, false, false])
    setStagger([])
    setRound(r => r + 1)
  }
  const title = opening.packId === 'free' ? 'free Street' : pack.name

  if (mobile) {
    return (
      <div className="mshell">
        <div className="m-head" style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))', paddingBottom: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 44, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{pack.name} pack</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{open.filter(Boolean).length} / 5</span>
        </div>
        <div className="mscroll" style={{ display: 'flex', flexDirection: 'column' }}>
          {opening.pulls.map((p, i) => {
            const c = CARS_BY_ID[p.carId], leg = p.tier === 'Legendary'
            return (
              <div key={i} className={`rm-card clickable${leg ? ' leg' : ''}`} onClick={() => flip(i)}>
                <span style={{ alignSelf: 'stretch', background: TIER_BAR[p.tier] }} />
                <Photo car={c} label="" className="rm-photo" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="rm-tier">{p.tier}{p.duplicate ? ` · +${num(p.credits)} CR` : ' · New'}</span>
                  <span className="rm-model">{c.model}</span>
                  <span style={{ fontSize: 12 }}>{makeGen(c)} · {c.year}</span>
                </div>
                <div className="rm-cover" style={{ transform: open[i] ? 'translateY(-101%)' : 'translateY(0)', transitionDelay: open[i] ? `${stagger[i] ?? 0}ms` : '0ms' }}>
                  Tap to reveal<span style={{ marginLeft: 'auto', fontSize: 28 }}>{i + 1}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="m-actions">
          {done ? (
            <>
              <span className="muted" style={{ fontSize: 13 }}>{newCount} new · {opening.pulls.length - newCount} duplicates · +{cr(opening.creditsBack)}</span>
              <Link to="/garage" className="btn btn-primary btn-md">Go to garage</Link>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-md" onClick={revealAll}>Reveal all</button>
              <Link to="/garage" className="btn btn-primary btn-md">Add to garage</Link>
            </>
          )}
        </div>
        {dialog}
      </div>
    )
  }

  return (
    <div className="r-screen">
      <div className="r-top">
        <Link to="/garage" className="r-brand">MARQUE</Link>
        <span className="r-sep" />
        <span style={{ fontSize: 14 }}>Opening <b>{title}</b> pack</span>
        <span className="muted tnum" style={{ marginLeft: 'auto', fontSize: 14 }}>{open.filter(Boolean).length} / 5 revealed</span>
      </div>
      <div className="split r-cards">
        {opening.pulls.map((p, i) => {
          const c = CARS_BY_ID[p.carId], leg = p.tier === 'Legendary', d = stagger[i] ?? 0
          return (
            <div key={`${round}-${i}`} className="r-slot" onClick={() => flip(i)} role="button" tabIndex={0}
              aria-label={open[i] ? `${c.make} ${c.model}` : `Reveal card ${i + 1}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') flip(i) }}>
              <div className="r-card">
                <div className="r-cover" style={{ transform: open[i] ? 'translateY(-101%)' : 'translateY(0)', transitionDelay: open[i] ? `${d}ms` : '0ms' }}>
                  <div style={{ height: 6, background: TIER_BAR[p.tier], margin: '-16px -16px 0' }} />
                  <span className="r-n tnum">{pad2(i + 1)}</span>
                  <span style={{ marginTop: 'auto', fontSize: 13 }}>Click to reveal</span>
                  <div style={{ height: 6, background: TIER_BAR[p.tier], margin: '0 -16px -16px' }} />
                </div>
                <div className={`r-face${leg ? ' leg' : ''}`} style={{ opacity: open[i] ? 1 : 0, transform: open[i] ? 'none' : 'translateY(32px)', transitionDelay: open[i] ? `${d + 350}ms` : '0ms' }}>
                  <div style={{ height: 6, background: TIER_BAR[p.tier] }} />
                  <div className="r-face-kicker">
                    <span>{p.tier}</span>
                    <span className={`r-badge${p.duplicate ? ' dup' : ''}`}>{p.duplicate ? 'Duplicate' : 'New'}</span>
                  </div>
                  <Photo car={c} className="r-photo" />
                  <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{makeGen(c)}</span>
                    <span style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{c.model}</span>
                  </div>
                  <div className="r-face-foot tnum">
                    <span>{c.year} · {c.hp} hp</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{p.duplicate ? `+${cr(p.credits)}` : 'Added'}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="r-bottom">
        {done ? (
          <div style={{ display: 'flex', gap: 32 }}>
            <div className="r-sum"><span className="label">New to garage</span><span>{newCount}</span></div>
            <div className="r-sum"><span className="label">Duplicates</span><span>{opening.pulls.length - newCount}</span></div>
            <div className="r-sum"><span className="label">Credits back</span><span className="tnum">+{cr(opening.creditsBack)}</span></div>
          </div>
        ) : (
          <span className="muted" style={{ fontSize: 14 }}>The tier colour on each card back shows its rarity before you flip it.</span>
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {done ? (
            <>
              <button className="btn btn-secondary r-btn" onClick={anotherPack} disabled={!!busy}>{busy ? 'Opening…' : `Open another · ${cr(pack.price)}`}</button>
              <Link to="/garage" className="btn btn-primary r-btn" style={{ minWidth: 180 }}>Go to garage</Link>
            </>
          ) : (
            <button className="btn btn-primary r-btn" style={{ minWidth: 180 }} onClick={revealAll}>Reveal all</button>
          )}
        </div>
      </div>
      {dialog}
    </div>
  )
}
