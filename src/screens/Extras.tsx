import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CARS_BY_ID, CREDIT_BUNDLES, MAX_LEVEL, RACE_EVENTS_BY_ID, UPGRADE_DELTA, VAT, upgradeCost, upgradedStats } from '@game'
import { backend, type Settings } from '../api'
import { Aside, Main, MobileHead } from '../components/Shell'
import { ConfirmDialog, Photo } from '../components/ui'
import { cr, euro, num, remaining } from '../lib/format'
import { useIsMobile, useNow, useWipeNavigate } from '../lib/hooks'
import { actions, useSnapshot } from '../state/store'
import './Extras.css'

/* ── 8a Settings ────────────────────────────────────────────────────── */

const PREFS: [keyof Settings, string, string][] = [
  ['sound', 'Sound effects', 'Engine and pack sounds'],
  ['reduceMotion', 'Reduce motion', 'Skip reveal and sweep animations'],
  ['notifications', 'Race notifications', 'When a friend challenges you'],
  ['showGarageValue', 'Show my garage value', 'On your public profile'],
]
const SETTING_TABS = ['Account', 'Notifications', 'Privacy', 'Payments', 'Language']

export function SettingsPage() {
  const snap = useSnapshot()
  const navigate = useWipeNavigate()
  const mobile = useIsMobile()
  const [f, setF] = useState({ username: snap.user.username, email: snap.user.email, region: snap.user.region })
  const [prefs, setPrefs] = useState<Settings>(snap.user.settings)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | string>('idle')
  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setStatus('saving')
    try { await actions.saveProfile({ ...f, settings: prefs }); setStatus('saved') } catch (err) { setStatus((err as Error).message) }
  }
  const logout = async () => { await actions.signOut(); navigate('/') }
  const dirty = f.username !== snap.user.username || f.email !== snap.user.email || f.region !== snap.user.region || JSON.stringify(prefs) !== JSON.stringify(snap.user.settings)

  const form = (
    <form className="st-form" onSubmit={save}>
      <span className="st-h">Account</span>
      <div className="field"><label htmlFor="st-u">Username</label><input id="st-u" className="input" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></div>
      <div className="field"><label htmlFor="st-e">Email</label><input id="st-e" className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label htmlFor="st-r">Region</label><input id="st-r" className="input" value={f.region} onChange={e => setF({ ...f, region: e.target.value })} /></div>
      <div style={{ height: 2, background: 'var(--color-divider)' }} />
      <span className="st-h">Preferences</span>
      <div>
        {PREFS.map(([k, label, desc]) => (
          <div key={k} className="st-pref">
            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600 }}>{label}</span><span className="muted" style={{ fontSize: 13 }}>{desc}</span></div>
            <button type="button" role="switch" aria-checked={prefs[k]} className={`st-toggle${prefs[k] ? ' on' : ''}`} onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })}>
              {prefs[k] ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ padding: '12px 20px' }} disabled={status === 'saving' || !dirty}>{status === 'saving' ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="btn btn-secondary" style={{ padding: '12px 20px' }} onClick={logout}>Log out</button>
        {status === 'saved' && !dirty && <span className="muted" style={{ fontSize: 13 }}>Saved.</span>}
        {status !== 'idle' && status !== 'saving' && status !== 'saved' && <span className="err">{status}</span>}
      </div>
    </form>
  )

  if (mobile) return <><MobileHead title="Settings" /><div className="mscroll">{form}</div></>
  return (
    <Main>
      <div className="st-grid">
        <div className="st-tabs">
          <span className="st-title">Settings</span>
          {SETTING_TABS.map((t, i) => <div key={t} className={`st-tab${i === 0 ? ' on' : ''}`}>{t}</div>)}
        </div>
        <div style={{ overflow: 'auto' }}>{form}</div>
      </div>
    </Main>
  )
}

/* ── 8b Credits top-up ──────────────────────────────────────────────── */

export function CreditsPage() {
  const snap = useSnapshot()
  const mobile = useIsMobile()
  const navigate = useWipeNavigate()
  const [sel, setSel] = useState(1)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState('')
  const b = CREDIT_BUNDLES[sel]
  const vat = Math.round(b.priceCents * VAT)
  const pay = async () => {
    setBusy(true); setError('')
    try { await actions.topUp(b.id); setDone(b.credits) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const bundles = (
    <div className="split cr-bundles">
      {CREDIT_BUNDLES.map((x, i) => (
        <button key={x.id} className={`cr-bundle${i === sel ? ' on' : ''}`} onClick={() => setSel(i)} aria-pressed={i === sel}>
          <span className="label" style={{ color: 'inherit' }}>{x.bestValue ? 'Best value' : 'Bundle'}</span>
          <span className="cr-amount tnum">{num(x.credits)}</span>
          <span style={{ fontSize: 14 }}>{x.name} · {euro(x.priceCents)}</span>
        </button>
      ))}
    </div>
  )
  const order = (
    <>
      <div className="cr-order-head">
        <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800 }}>Order</span>
        <div className="tnum" style={{ fontWeight: 800, fontSize: 44, lineHeight: 1, paddingTop: 12 }}>{num(b.credits)} CR</div>
      </div>
      <div className="cr-lines">
        <div><span>Bundle</span><span>{euro(b.priceCents)}</span></div>
        <div><span>VAT 20%</span><span>{euro(vat)}</span></div>
        <div className="total"><span>Total</span><span>{euro(b.priceCents + vat)}</span></div>
        <div className="muted" style={{ fontSize: 13 }}><span>Balance after</span><span>{cr(snap.user.credits + b.credits)}</span></div>
      </div>
      <div style={{ padding: '0 24px' }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Card payment goes through the payment provider’s secure form.{backend === 'mock' ? ' The local demo adds credits without charging.' : ''}
        </p>
        {error && <p className="err" style={{ margin: '8px 0 0' }}>{error}</p>}
      </div>
      <div style={{ marginTop: 'auto', padding: 24 }}>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={pay} disabled={busy}>{busy ? 'Processing…' : `Pay ${euro(b.priceCents + vat)}`}</button>
      </div>
    </>
  )
  const dialog = done !== null && (
    <ConfirmDialog kind="Top-up complete" title={`+${cr(done)}`} rows={[['New balance', cr(snap.user.credits)]]} ok="Visit the pack shop"
      onOk={() => { setDone(null); navigate('/packs') }} onCancel={() => setDone(null)} />
  )
  if (mobile) return <><MobileHead title="Credits" /><div className="mscroll">{bundles}{order}</div>{dialog}</>
  return (
    <>
      <Main>
        <div className="page-head" style={{ alignItems: 'flex-end' }}>
          <span className="page-title">Credits</span>
          <span className="meta tnum">Balance {cr(snap.user.credits)}</span>
        </div>
        {bundles}
      </Main>
      <Aside width={400}>{order}</Aside>
      {dialog}
    </>
  )
}

/* ── 8c Car upgrade ─────────────────────────────────────────────────── */

export function UpgradePage() {
  const { carId = '' } = useParams()
  const snap = useSnapshot()
  const navigate = useWipeNavigate()
  const mobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const owned = snap.garage.find(g => g.carId === carId)
  const car = CARS_BY_ID[carId]
  if (!owned || !car) return <Navigate to="/garage" replace />
  const lvl = owned.level, maxed = lvl >= MAX_LEVEL, cost = upgradeCost(lvl)
  const now = upgradedStats(car, lvl)
  const short = cost !== null && snap.user.credits < cost
  const up = async () => {
    if (short) { navigate('/credits'); return }
    setBusy(true); setError('')
    try { await actions.upgradeCar(carId) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const stats = [
    { k: 'Power', v: `${now.hp} hp`, d: maxed ? '' : `+${UPGRADE_DELTA.hp} hp next` },
    { k: '0–100', v: `${now.acc.toFixed(1)} s`, d: maxed ? '' : `−${Math.abs(UPGRADE_DELTA.acc).toFixed(1)} s next` },
    { k: 'Top speed', v: `${now.top} km/h`, d: maxed ? '' : `+${UPGRADE_DELTA.top} km/h next` },
    { k: 'Weight', v: `${num(now.kg)} kg`, d: maxed ? '' : `−${Math.abs(UPGRADE_DELTA.kg)} kg next` },
  ]
  const parts = [
    { k: 'Engine tune', d: `+${UPGRADE_DELTA.hp} hp per level`, lv: lvl },
    { k: 'Gearbox', d: 'Shorter ratios', lv: Math.min(lvl, 3) },
    { k: 'Tires', d: 'Better launch', lv: Math.min(lvl, 2) },
    { k: 'Lightweight kit', d: `−${Math.abs(UPGRADE_DELTA.kg)} kg per level`, lv: lvl },
  ]
  const label = maxed ? 'Max level reached' : short ? `Top up to upgrade · ${cr(cost!)}` : `Upgrade for ${cr(cost!)}`
  const head = (
    <div className="up-head">
      <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800 }}>{car.tier} · Level {lvl}</span>
      <div className="up-model">{car.model}</div>
      <span style={{ fontSize: 14 }}>{car.make}{car.gen ? ` · ${car.gen}` : ''} · {car.year}</span>
    </div>
  )
  const statGrid = (
    <div className="split up-stats">
      {stats.map(s => (
        <div key={s.k}>
          <div className="label">{s.k}</div>
          <div className="tnum up-stat-v">{s.v}</div>
          <div style={{ fontSize: 12, color: 'var(--color-accent-700)', minHeight: 16 }}>{s.d}</div>
        </div>
      ))}
    </div>
  )
  const side = (
    <>
      <div className="label" style={{ padding: '24px 24px 8px' }}>Parts</div>
      {parts.map(p => (
        <div key={p.k} className="up-part">
          <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800 }}>{p.k}</span><span className="muted" style={{ fontSize: 12 }}>{p.d}</span></div>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800 }}>Lv {p.lv}</span>
        </div>
      ))}
      <div className="up-pips">
        {Array.from({ length: MAX_LEVEL }, (_, i) => <span key={i} style={{ background: i < lvl ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} />)}
      </div>
      <div style={{ marginTop: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>{maxed ? `Level ${MAX_LEVEL} · fully upgraded` : `Level ${lvl} to ${lvl + 1} · ${cr(cost!)} · balance ${cr(snap.user.credits)}`}</span>
        {error && <span className="err">{error}</span>}
        <button className="btn btn-primary btn-lg" onClick={up} disabled={maxed || busy}>{busy ? 'Upgrading…' : label}</button>
        <Link to={`/garage/${carId}`} className="btn btn-secondary btn-md">Back to garage</Link>
      </div>
    </>
  )
  if (mobile) return <div className="mscroll" style={{ display: 'flex', flexDirection: 'column' }}>{head}<Photo car={car} label="car photo · side profile" style={{ aspectRatio: '16 / 10' }} />{statGrid}{side}</div>
  return (
    <>
      <Main>
        {head}
        <Photo car={car} label="car photo · side profile" className="up-photo" />
        {statGrid}
      </Main>
      <Aside width={400}>{side}</Aside>
    </>
  )
}

/* ── 8d Events ──────────────────────────────────────────────────────── */

export function EventsPage() {
  const snap = useSnapshot()
  const navigate = useWipeNavigate()
  const mobile = useIsMobile()
  const now = useNow(60_000)
  const enter = (eventId: keyof typeof RACE_EVENTS_BY_ID) => { actions.setRace({ eventId }); navigate('/race') }
  const list = snap.events.map((e, i) => {
    const d = new Date(e.date)
    return (
      <div key={e.id} className={`ev-row list-row${e.featured ? ' hot' : ''}`} style={{ '--i': i } as CSSProperties}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="label" style={{ color: 'inherit' }}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
          <span className="ev-date">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span className="ev-name">{e.name}</span><span style={{ fontSize: 13 }}>{e.rule}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span className="label" style={{ color: 'inherit' }}>Prize</span><span style={{ fontWeight: 800 }}>{e.prize}</span></div>
        <button className="ev-cta" onClick={() => enter(e.eventId)}>Enter · {cr(e.fee)}</button>
      </div>
    )
  })
  if (mobile) return <><MobileHead title="Events" right={<span className="m-credits">{remaining(snap.seasonEndsAt - now)} left</span>} /><div className="mscroll">{list}</div></>
  return (
    <Main>
      <div className="page-head">
        <span className="page-title">Events</span>
        <span className="meta">Season {snap.season} · {remaining(snap.seasonEndsAt - now)} left</span>
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>{list}</div>
    </Main>
  )
}

/* ── 8e Friends ─────────────────────────────────────────────────────── */

export function FriendsPage() {
  const snap = useSnapshot()
  const navigate = useWipeNavigate()
  const mobile = useIsMobile()
  const [sel, setSel] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const f = snap.friends[sel] ?? snap.friends[0]
  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try { await actions.addFriend(name); setName('') } catch (err) { setError((err as Error).message) }
  }
  const challenge = () => { navigate('/race') }
  const addForm = (
    <form onSubmit={add} className="fr-add">
      <input className="input" placeholder="Add by username" aria-label="Add a friend by username" value={name} onChange={e => setName(e.target.value)} />
      {error && <span className="err">{error}</span>}
    </form>
  )
  const rows = snap.friends.map((x, i) => (
    <div key={x.name} className={`fr-row clickable list-row${i === sel ? ' on' : ''}`} style={{ '--i': i } as CSSProperties} onClick={() => setSel(i)}>
      <span style={{ width: 12, height: 12, background: x.online ? 'var(--color-accent)' : 'var(--color-neutral-400)' }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800, fontSize: 17 }}>{x.name}</span><span className="muted" style={{ fontSize: 12 }}>{x.status}</span></div>
      <span className="fr-cars" style={{ fontSize: 14 }}>{num(x.cars)} cars</span>
      <span className="tnum" style={{ fontWeight: 800 }}>{num(x.points)} pts</span>
    </div>
  ))
  const empty = <p className="muted" style={{ padding: 24 }}>No friends yet. Add someone by username.</p>

  if (mobile) {
    return (
      <>
        <MobileHead title="Friends" right={<span />} />
        <div style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-divider)' }}>{addForm}</div>
        <div className="mscroll">{rows.length ? rows : empty}</div>
        {f && (
          <div className="m-actions">
            <button className="btn btn-primary btn-md" onClick={challenge}>Challenge {f.name} to a race</button>
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/market')}>Propose a swap</button>
          </div>
        )}
      </>
    )
  }
  return (
    <>
      <Main>
        <div className="page-head">
          <span className="page-title">Friends</span>
          <div style={{ marginLeft: 'auto', width: 260, paddingBottom: 4 }}>{addForm}</div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>{rows.length ? rows : empty}</div>
      </Main>
      <Aside width={380}>
        {f ? (
          <>
            <div className="fr-sel">
              <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Selected</span>
              <div style={{ fontWeight: 800, fontSize: 44, lineHeight: 1, paddingTop: 8, overflowWrap: 'anywhere' }}>{f.name}</div>
              <div style={{ fontSize: 14, paddingTop: 6 }}>{f.status}</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="label">Showcase</span>
              <span style={{ fontWeight: 800, fontSize: 20 }}>{f.showcase}</span>
              <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>{num(f.cars)} cars · {num(f.points)} season points</span>
            </div>
            <div style={{ marginTop: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" style={{ padding: '14px 16px' }} onClick={challenge}>Challenge to a race</button>
              <button className="btn btn-secondary" style={{ padding: '14px 16px' }} onClick={() => navigate('/market')}>Propose a swap</button>
            </div>
          </>
        ) : <div className="fr-sel"><span style={{ fontWeight: 800, fontSize: 32 }}>No one selected</span></div>}
      </Aside>
    </>
  )
}
