import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CARS_BY_ID, STARTER_PACK_SIZE, TASTES, carLabel, makeGen } from '@game'
import { backend } from '../api'
import { Photo, TIER_BAR } from '../components/ui'
import { num } from '../lib/format'
import { useWipeNavigate } from '../lib/hooks'
import { actions, useApp } from '../state/store'
import './Onboarding.css'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usingMock = backend === 'mock'

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ob-auth">
      <div className="ob-red">
        <Link to="/" className="ob-brand">MARQUE</Link>
        <span className="ob-red-title">Your first pack is free.</span>
      </div>
      {children}
    </div>
  )
}

/* 7a */
export function SignUpPage() {
  const navigate = useWipeNavigate()
  const [f, setF] = useState({ username: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f | 'form', string>>>({})
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (f.username.trim().length < 3) errs.username = 'At least 3 characters.'
    if (!EMAIL.test(f.email.trim())) errs.email = 'Enter a valid email address.'
    if (f.password.length < 8) errs.password = 'At least 8 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try { await actions.signUp(f); navigate('/welcome/tastes') } catch (err) { setErrors({ form: (err as Error).message }) } finally { setBusy(false) }
  }
  const field = (k: keyof typeof f, label: string, type: string, placeholder: string, autoComplete: string) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} className="input" type={type} placeholder={placeholder} autoComplete={autoComplete} value={f[k]}
        aria-invalid={!!errors[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
      {errors[k] && <span className="err">{errors[k]}</span>}
    </div>
  )
  return (
    <AuthLayout>
      <form className="ob-form" onSubmit={submit} noValidate>
        <span className="ob-form-title">Create your garage</span>
        {field('username', 'Username', 'text', 'j.durand', 'username')}
        {field('email', 'Email', 'email', 'you@example.com', 'email')}
        {field('password', 'Password', 'password', 'At least 8 characters', 'new-password')}
        {errors.form && <span className="err">{errors.form}</span>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>Already collecting? <Link to="/login">Log in</Link></span>
        <span className="ob-fine">By continuing you accept the terms and the published pack odds.</span>
      </form>
    </AuthLayout>
  )
}

export function LoginPage() {
  const navigate = useWipeNavigate()
  const [f, setF] = useState({ email: usingMock ? 'j.durand@example.com' : '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await actions.signIn(f); navigate('/garage') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthLayout>
      <form className="ob-form" onSubmit={submit}>
        <span className="ob-form-title">Welcome back</span>
        <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
        {error && <span className="err">{error}</span>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>New here? <Link to="/signup">Create your garage</Link></span>
        {usingMock && <span className="ob-fine">Local demo: no backend is connected, so the demo garage loads with any password.</span>}
      </form>
    </AuthLayout>
  )
}

/* 7b */
export function TastesPage() {
  const tastes = useApp(s => s.tastes)
  const signedIn = useApp(s => !!s.snapshot)
  if (!signedIn) return <Navigate to="/signup" replace />
  const toggle = (id: (typeof tastes)[number]) => actions.setTastes(tastes.includes(id) ? tastes.filter(t => t !== id) : [...tastes, id])
  return (
    <div className="ob-screen">
      <div className="ob-top"><span className="ob-brand" style={{ color: 'var(--color-text)' }}>MARQUE</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>Step 2 of 3</span></div>
      <div className="ob-title-row">
        <span className="page-title">What do you love?</span>
        <span className="ob-title-note">Pick as many as you like. Your free pack leans toward them.</span>
      </div>
      <div className="split ob-tastes">
        {TASTES.map(t => {
          const on = tastes.includes(t.id)
          return (
            <button key={t.id} className={`ob-taste${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(t.id)}>
              <span className="label" style={{ color: 'inherit' }}>{on ? 'Selected' : 'Select'}</span>
              <span className="ob-taste-name">{t.name}</span>
              <span style={{ fontSize: 14 }}>{t.examples}</span>
            </button>
          )
        })}
      </div>
      <div className="ob-foot">
        <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>{tastes.length} selected</span>
        <Link to="/welcome/pack" className="btn btn-primary" style={{ marginLeft: 'auto', padding: '14px 20px', minWidth: 240 }}>Continue</Link>
      </div>
    </div>
  )
}

/* 7c */
export function FirstPackPage() {
  const snap = useApp(s => s.snapshot)
  const starter = useApp(s => s.starter)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!snap) return <Navigate to="/signup" replace />
  const opened = !!starter
  const open = async () => {
    if (opened || busy) return
    setBusy(true); setError('')
    try { await actions.completeOnboarding() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const hero = starter ? CARS_BY_ID[starter[0]] : null
  const rest = starter ? starter.slice(1).map(id => CARS_BY_ID[id]) : []
  return (
    <div className="ob-pack">
      <div className="ob-card" onClick={open} role="button" tabIndex={0} aria-label="Open your starter pack" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') void open() }}>
        <div style={{ height: 10, background: hero ? TIER_BAR[hero.tier] : 'var(--color-accent-700)' }} />
        <Photo car={hero ?? undefined} label="car photo · 3/4 front" className="ob-card-photo" />
        {hero && (
          <div className="ob-card-body">
            <span className="label" style={{ color: 'inherit', fontWeight: 800, fontSize: 12 }}>{hero.tier} · New</span>
            <span className="ob-card-model">{hero.make} {hero.model}</span>
            <span style={{ fontSize: 15 }}>{[hero.gen, hero.year, `${hero.hp} hp`, `${num(hero.kg)} kg`].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        <div className="ob-cover" style={{ transform: `translateY(${opened ? '-101%' : '0%'})` }}>
          <span className="ob-cover-title">{busy ? 'Opening…' : 'Click to open'}</span>
          <span style={{ fontSize: 15, paddingTop: 12 }}>Starter pack · {STARTER_PACK_SIZE} cars</span>
        </div>
      </div>
      <div className="ob-side">
        <span className="muted" style={{ fontSize: 13 }}>Step 3 of 3</span>
        <span className="ob-side-title">{opened ? 'Welcome to the club.' : 'Open your pack.'}</span>
        <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--color-neutral-800)' }}>
          {hero ? `The ${hero.make} ${carLabel(hero)} is now in your garage, along with two more cars. Rarer cars are one pack, one race or one trade away.`
            : 'Three cars chosen from the tastes you picked. Odds are the same as the shop.'}
        </p>
        {rest.length > 0 && (
          <div className="ob-rest">
            {rest.map(c => (
              <div key={c.id} className="ob-rest-row">
                <span style={{ width: 6, alignSelf: 'stretch', background: TIER_BAR[c.tier] }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800 }}>{c.model}</span><span className="muted" style={{ fontSize: 12 }}>{makeGen(c)} · {c.tier}</span></div>
              </div>
            ))}
          </div>
        )}
        {error && <span className="err">{error}</span>}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to="/garage" className="btn btn-primary btn-lg">Go to my garage</Link>
          <Link to="/packs" className="btn btn-secondary btn-lg">Visit the pack shop</Link>
        </div>
      </div>
    </div>
  )
}
