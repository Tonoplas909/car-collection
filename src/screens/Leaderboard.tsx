import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { api, type Leaderboard, type LeaderboardMetric, type LeaderboardScope } from '../api'
import { Aside, Main } from '../components/Shell'
import { compact, num, pad2, remaining } from '../lib/format'
import { useIsMobile, useNow } from '../lib/hooks'
import { useSnapshot } from '../state/store'
import './Leaderboard.css'

const METRICS: Record<LeaderboardMetric, { label: string; short: string; unit: string }> = {
  race: { label: 'Race points', short: 'Race points', unit: 'pts' },
  value: { label: 'Garage value', short: 'Value', unit: 'CR' },
  size: { label: 'Cars owned', short: 'Cars', unit: 'cars' },
}
const SCOPES: Record<LeaderboardScope, string> = { global: 'Global', friends: 'Friends', region: 'France' }
const REWARDS: [string, string][] = [['Top 10', 'Legendary pack + title'], ['Top 1%', 'Apex pack'], ['Top 5%', '2 Heritage packs'], ['Top 25%', '10,000 CR']]

function useBoard(metric: LeaderboardMetric, scope: LeaderboardScope) {
  const snap = useSnapshot()
  const [board, setBoard] = useState<Leaderboard | null>(null)
  useEffect(() => {
    let live = true
    api.leaderboard(metric, scope).then(b => { if (live) setBoard(b) })
    return () => { live = false }
  }, [metric, scope, snap])
  return board
}

const score = (n: number, metric: LeaderboardMetric) => `${num(n)} ${METRICS[metric].unit}`

export function LeaderboardPage() {
  const [metric, setMetric] = useState<LeaderboardMetric>('race')
  const [scope, setScope] = useState<LeaderboardScope>('global')
  const board = useBoard(metric, scope)
  const mobile = useIsMobile()
  const snap = useSnapshot()
  const now = useNow(60_000)
  if (mobile) return <LeaderboardMobile metric={metric} setMetric={setMetric} board={board} />

  const rows = board?.rows ?? []
  const me = board?.me
  return (
    <>
      <Main>
        <div className="lb-head">
          <span className="page-title">Ranks</span>
          <div className="bseg" style={{ marginLeft: 'auto', marginBottom: 4 }}>
            {(Object.keys(SCOPES) as LeaderboardScope[]).map(s => (
              <button key={s} aria-pressed={scope === s} onClick={() => setScope(s)}>{SCOPES[s]}</button>
            ))}
          </div>
        </div>
        <div className="lb-tabs" role="tablist">
          {(Object.keys(METRICS) as LeaderboardMetric[]).map(m => (
            <button key={m} role="tab" className="utab" aria-selected={metric === m} onClick={() => setMetric(m)}>{METRICS[m].label}</button>
          ))}
        </div>
        <div className="split lb-podium">
          {rows.slice(0, 3).map((p, i) => (
            <div key={p.name} className={i === 0 ? 'first' : ''}>
              <span className="lb-rank">{pad2(i + 1)}</span>
              <span className="lb-name">{p.name}</span>
              <span style={{ fontSize: 13 }}>{p.cc} · {p.car}</span>
              <span className="lb-score tnum">{score(p.score, metric)}</span>
            </div>
          ))}
        </div>
        <div className="lb-row lb-th"><span>Rank</span><span>Player</span><span>Best car</span><span style={{ textAlign: 'right' }}>{METRICS[metric].label}</span></div>
        <div className="lb-list">
          {rows.slice(3).map((r, i) => (
            <div key={`${metric}-${scope}-${r.name}`} className="lb-row lb-tr list-row" style={{ '--i': i } as CSSProperties}>
              <span className="tnum" style={{ fontWeight: 800 }}>{r.rank}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><span style={{ fontWeight: 600 }}>{r.name}</span><span className="muted" style={{ fontSize: 12 }}>{r.cc}</span></span>
              <span className="lb-car">{r.car}</span>
              <span className="tnum" style={{ textAlign: 'right', fontWeight: 800 }}>{score(r.score, metric)}</span>
            </div>
          ))}
        </div>
        {me && (
          <div className="lb-row lb-me">
            <span className="tnum" style={{ fontWeight: 800 }}>#{num(me.rank)}</span>
            <span style={{ fontWeight: 800 }}>You · {snap.user.username}</span>
            <span style={{ fontSize: 13 }}>{me.car}</span>
            <span className="tnum" style={{ textAlign: 'right', fontWeight: 800 }}>{score(me.score, metric)}</span>
          </div>
        )}
      </Main>
      <Aside width={320}>
        <div className="lb-side rule-b">
          <span className="label">Your rank · {SCOPES[scope]}</span>
          <span className="lb-myrank tnum">#{me ? num(me.rank) : '—'}</span>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>{me?.percentile}</span>
        </div>
        <div className="lb-side rule-b" style={{ gap: 10 }}>
          <span className="label">Next rank up</span>
          <span style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.15 }}>
            {me ? `${metric === 'value' ? num(me.gapToNext) + ' CR' : num(me.gapToNext) + ' ' + (metric === 'size' ? (me.gapToNext === 1 ? 'car' : 'cars') : 'pts')} to pass ${me.rank > 1 ? '#' + num(me.rank - 1) : 'the leader'}` : ''}
          </span>
          <div className="track"><span style={{ width: `${Math.round((me?.progress ?? 0) * 100)}%` }} /></div>
        </div>
        <div className="lb-side rule-b">
          <span className="label">Season {snap.season} ends in</span>
          <span className="tnum" style={{ fontWeight: 800, fontSize: 32, lineHeight: 1.05 }}>{remaining(snap.seasonEndsAt - now)}</span>
        </div>
        <div className="lb-side" style={{ gap: 8 }}>
          <span className="label">Season rewards</span>
          {REWARDS.map(([k, v]) => (
            <div key={k} className="lb-reward hair-b"><span style={{ fontWeight: 600 }}>{k}</span><span style={{ marginLeft: 'auto', textAlign: 'right' }}>{v}</span></div>
          ))}
        </div>
      </Aside>
    </>
  )
}

function LeaderboardMobile({ metric, setMetric, board }: { metric: LeaderboardMetric; setMetric: (m: LeaderboardMetric) => void; board: Leaderboard | null }) {
  const snap = useSnapshot()
  const top = board?.rows[0]
  const fmt = (n: number) => (metric === 'value' ? compact(n) : num(n))
  return (
    <>
      <div className="lbm-head">
        <span className="m-title">Ranks</span>
        <div className="lbm-tabs">
          {(Object.keys(METRICS) as LeaderboardMetric[]).map(m => (
            <button key={m} className="utab" aria-selected={metric === m} onClick={() => setMetric(m)}>{METRICS[m].short}</button>
          ))}
        </div>
      </div>
      {top && (
        <div className="lbm-top">
          <span className="lbm-top-rank">01</span>
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 2 }}>
            <span style={{ fontWeight: 800, fontSize: 18 }}>{top.name}</span>
            <span style={{ fontSize: 12 }}>{top.cc} · {top.car}</span>
          </div>
          <span className="tnum" style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 18 }}>{fmt(top.score)}</span>
        </div>
      )}
      <div className="mscroll">
        {board?.rows.slice(1).map((r, i) => (
          <div key={`${metric}-${r.name}`} className="lbm-row list-row" style={{ '--i': i } as CSSProperties}>
            <span className="tnum" style={{ fontWeight: 800 }}>{r.rank}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</span><span className="muted" style={{ fontSize: 11 }}>{r.car}</span></div>
            <span className="tnum" style={{ fontWeight: 800, fontSize: 14 }}>{fmt(r.score)}</span>
          </div>
        ))}
      </div>
      {board && (
        <Link to="/profile" className="lbm-row lbm-me" aria-label="Your profile">
          <span style={{ fontWeight: 800 }}>{num(board.me.rank)}</span>
          <span style={{ fontWeight: 800 }}>You · {snap.user.username} ›</span>
          <span className="tnum" style={{ fontWeight: 800 }}>{fmt(board.me.score)}</span>
        </Link>
      )}
    </>
  )
}
