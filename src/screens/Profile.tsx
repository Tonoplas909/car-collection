import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CATALOG, CARS_BY_ID, TIERS, TIER_RANK, XP_PER_LEVEL, makeGen, type Car } from '@game'
import { Aside, Main } from '../components/Shell'
import { Photo, TIER_BAR } from '../components/ui'
import { ago, compact, cr, num } from '../lib/format'
import { useIsMobile } from '../lib/hooks'
import { useSnapshot } from '../state/store'
import './Profile.css'

const TIER_TRACK = { ...TIER_BAR, Common: 'var(--color-neutral-500)' }

function useProfile() {
  const snap = useSnapshot()
  return useMemo(() => {
    const owned = snap.garage.map(g => ({ ...g, car: CARS_BY_ID[g.carId] })).filter(x => x.car)
    const ownedIds = new Set(owned.map(o => o.carId))
    const value = owned.reduce((a, o) => a + o.car.value, 0)
    const byTier = TIERS.map(t => ({ k: t, have: owned.filter(o => o.car.tier === t).length, total: CATALOG.filter(c => c.tier === t).length, bar: TIER_TRACK[t] }))
    const countries = [...new Set(CATALOG.map(c => c.country))]
      .map(k => ({ k, have: CATALOG.filter(c => c.country === k && ownedIds.has(c.id)).length, total: CATALOG.filter(c => c.country === k).length }))
      .sort((a, b) => b.total - a.total)
    const showcase: Car[] = owned.filter(o => o.showcase).map(o => o.car)
    for (const o of [...owned].sort((a, b) => TIER_RANK[b.car.tier] - TIER_RANK[a.car.tier] || b.car.value - a.car.value)) {
      if (showcase.length >= 3) break
      if (!showcase.includes(o.car)) showcase.push(o.car)
    }
    const s = snap.stats
    const winRate = s.racesRun ? Math.round((s.racesWon / s.racesRun) * 100) : 0
    const stats = [
      { k: 'Cars owned', v: String(owned.length), sub: `of ${CATALOG.length} in the game` },
      { k: 'Garage value', v: compact(value), sub: 'CR' },
      { k: 'Races won', v: num(s.racesWon), sub: `of ${num(s.racesRun)} · ${winRate}% win rate` },
      { k: 'Race points', v: num(s.seasonPoints), sub: `Season ${snap.season}` },
      { k: 'Packs opened', v: num(s.packsOpened), sub: `${s.legendaryPulls} Legendary pulls` },
      { k: 'Market trades', v: num(s.trades), sub: `${s.tradeNet >= 0 ? '+' : '−'}${cr(Math.abs(s.tradeNet))} net` },
      { k: 'Best lap', v: s.bestLap, sub: 'Nürburgring GP' },
      { k: 'Login streak', v: `${s.streak} day${s.streak === 1 ? '' : 's'}`, sub: `Best: ${s.bestStreak} days` },
    ]
    return { snap, owned, byTier, countries, showcase, stats }
  }, [snap])
}

const sinceStr = (t: number) => new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export function ProfilePage() {
  return useIsMobile() ? <ProfileMobile /> : <ProfileDesktop />
}

function Bars({ items, color }: { items: { k: string; have: number; total: number; bar?: string }[]; color?: string }) {
  return (
    <>
      {items.map(t => (
        <div key={t.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', fontSize: 14 }}><span style={{ fontWeight: 600 }}>{t.k}</span><span className="tnum" style={{ marginLeft: 'auto' }}>{t.have} / {t.total}</span></div>
          <div className="track"><span style={{ width: `${t.total ? Math.round((t.have / t.total) * 100) : 0}%`, background: t.bar ?? color }} /></div>
        </div>
      ))}
    </>
  )
}

function ProfileDesktop() {
  const { snap, byTier, countries, showcase, stats } = useProfile()
  const u = snap.user
  return (
    <>
      <Main scroll>
        <div className="pf-head">
          <Photo label="avatar" className="pf-avatar" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label" style={{ fontSize: 12 }}>{[u.city, u.region].filter(Boolean).join(', ')} · since {sinceStr(u.since)}</span>
            <span className="pf-name">{u.username}</span>
            <div className="pf-xp">
              <span style={{ fontWeight: 800, fontSize: 15 }}>Lv {u.level}</span>
              <div className="track" style={{ flex: 1 }}><span style={{ width: `${Math.round((u.xp / XP_PER_LEVEL) * 100)}%` }} /></div>
              <span className="muted tnum" style={{ fontSize: 13 }}>{num(u.xp)} / {num(XP_PER_LEVEL)} XP</span>
            </div>
          </div>
        </div>
        <div className="split pf-stats">
          {stats.map(s => (
            <div key={s.k}><span className="label">{s.k}</span><span className="pf-stat-v tnum">{s.v}</span><span className="muted" style={{ fontSize: 12 }}>{s.sub}</span></div>
          ))}
        </div>
        <div className="split pf-coll">
          <div><span className="label">Collection by tier</span><Bars items={byTier} /></div>
          <div><span className="label">Collection by country</span><Bars items={countries} color="var(--color-text)" /></div>
        </div>
      </Main>
      <Aside width={360}>
        <div className="pf-side-head">
          <span style={{ fontWeight: 800, fontSize: 20 }}>Showcase</span>
          <Link to="/garage" style={{ marginLeft: 'auto', fontSize: 13 }}>Edit</Link>
        </div>
        <div className="split pf-showcase">
          {showcase.map((c, i) => (
            <Link key={c.id} to={`/garage/${c.id}`} className={`pf-show clickable${i === 0 && c.tier === 'Legendary' ? ' red' : ''}`}>
              <Photo car={c} className="pf-show-photo" />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800 }}>{c.tier}</span>
                <span style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15 }}>{c.model}</span>
                <span style={{ fontSize: 12 }}>{makeGen(c)} · {c.year}</span>
              </div>
            </Link>
          ))}
          {!showcase.length && <p className="muted" style={{ padding: '12px 24px', margin: 0 }}>Your best cars appear here.</p>}
        </div>
        <div style={{ padding: '20px 24px 8px' }}><span style={{ fontWeight: 800, fontSize: 20 }}>Recent activity</span></div>
        <div className="pf-activity">
          {snap.activity.slice(0, 20).map((a, i) => (
            <div key={i} className="pf-act list-row" style={{ '--i': i } as CSSProperties}>
              <span className="muted tnum" style={{ fontSize: 12 }}>{ago(a.at)}</span>
              <span><b>{a.verb}</b> {a.what}</span>
            </div>
          ))}
          {!snap.activity.length && <p className="muted">Nothing yet. Open a pack or enter a race.</p>}
        </div>
      </Aside>
    </>
  )
}

function ProfileMobile() {
  const { snap, byTier, stats } = useProfile()
  const u = snap.user
  return (
    <div className="mscroll">
      <div className="pfm-head">
        <Photo label="" className="pf-avatar" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="label">{[u.city, u.region].filter(Boolean).join(', ')}</span>
          <span style={{ fontWeight: 800, fontSize: 36, lineHeight: 0.95, letterSpacing: '-0.03em' }}>{u.username}</span>
        </div>
      </div>
      <div className="pfm-xp">
        <span style={{ fontWeight: 800 }}>Lv {u.level}</span>
        <div className="track" style={{ flex: 1 }}><span style={{ width: `${Math.round((u.xp / XP_PER_LEVEL) * 100)}%` }} /></div>
        <span className="muted tnum" style={{ fontSize: 12 }}>{num(u.xp)} / {num(XP_PER_LEVEL)}</span>
      </div>
      <div className="split pfm-stats">
        {stats.filter((_, i) => [0, 1, 2, 3, 4, 6].includes(i)).map(s => (
          <div key={s.k}><span className="label-sm" style={{ letterSpacing: '.08em' }}>{s.k}</span><span className="tnum" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.05 }}>{s.v}</span></div>
        ))}
      </div>
      <div className="pfm-block rule-b"><span className="label">Collection by tier</span><Bars items={byTier} /></div>
      <div className="pfm-block" style={{ gap: 0 }}>
        <span className="label" style={{ paddingBottom: 6 }}>Recent activity</span>
        {snap.activity.slice(0, 8).map((a, i) => <div key={i} className="pfm-act"><b>{a.verb}</b> {a.what}</div>)}
      </div>
      <div className="pfm-block" style={{ paddingTop: 0 }}>
        <Link to="/settings" className="btn btn-secondary btn-md">Settings</Link>
        <Link to="/friends" className="btn btn-secondary btn-md">Friends</Link>
        <Link to="/events" className="btn btn-secondary btn-md">Events</Link>
      </div>
    </div>
  )
}
