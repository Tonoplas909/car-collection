import { Component, computed, inject, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { CARS_BY_ID, STARTER_PACK_SIZE, TASTES, carLabel, makeGen, type TasteId } from '@game'
import { num } from '../../core/format'
import { errorMessage } from '../../core/game-error'
import { Store } from '../../core/store'
import { TIER_BAR } from '../../core/tiers'
import { Nav } from '../../core/ui'
import { Photo } from '../../shared/photo'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Red brand panel shared by sign-up and log-in. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink],
  host: { class: 'ob-auth' },
  template: `
    <div class="ob-red">
      <a routerLink="/" class="ob-brand">MARQUE</a>
      <span class="ob-red-title">Your first pack is free.</span>
    </div>
    <ng-content />
  `,
})
export class AuthLayout {}

/* 7a */
@Component({
  selector: 'app-signup',
  imports: [AuthLayout, RouterLink],
  template: `
    <app-auth-layout>
      <form class="ob-form" (submit)="submit($event)" novalidate>
        <span class="ob-form-title">Create your garage</span>
        @for (f of fields; track f.k) {
          <div class="field">
            <label [for]="f.k">{{ f.label }}</label>
            <input [id]="f.k" class="input" [type]="f.type" [placeholder]="f.placeholder" [autocomplete]="f.auto"
              [value]="form()[f.k]" [attr.aria-invalid]="!!errors()[f.k]" (input)="set(f.k, $event)" />
            @if (errors()[f.k]; as e) { <span class="err">{{ e }}</span> }
          </div>
        }
        @if (errors().form; as e) { <span class="err">{{ e }}</span> }
        <button class="btn btn-primary btn-lg" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create account' }}</button>
        <span style="font-size: 14px; color: var(--color-neutral-800)">Already collecting? <a routerLink="/login">Log in</a></span>
        <span class="ob-fine">By continuing you accept the terms and the published pack odds.</span>
      </form>
    </app-auth-layout>
  `,
})
export class SignUp {
  private store = inject(Store)
  private nav = inject(Nav)
  protected readonly fields = [
    { k: 'username', label: 'Username', type: 'text', placeholder: 'j.durand', auto: 'username' },
    { k: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', auto: 'email' },
    { k: 'password', label: 'Password', type: 'password', placeholder: 'At least 8 characters', auto: 'new-password' },
  ] as const
  protected form = signal({ username: '', email: '', password: '' })
  protected errors = signal<Partial<Record<'username' | 'email' | 'password' | 'form', string>>>({})
  protected busy = signal(false)

  protected set(k: 'username' | 'email' | 'password', e: Event) {
    this.form.update(f => ({ ...f, [k]: (e.target as HTMLInputElement).value }))
  }

  protected async submit(e: Event) {
    e.preventDefault()
    const f = this.form()
    const errs: ReturnType<typeof this.errors> = {}
    if (f.username.trim().length < 3) errs.username = 'At least 3 characters.'
    if (!EMAIL.test(f.email.trim())) errs.email = 'Enter a valid email address.'
    if (f.password.length < 8) errs.password = 'At least 8 characters.'
    this.errors.set(errs)
    if (Object.keys(errs).length) return
    this.busy.set(true)
    try {
      await this.store.signUp(f)
      this.nav.go('/welcome/tastes')
    } catch (err) {
      this.errors.set({ form: errorMessage(err) })
    } finally {
      this.busy.set(false)
    }
  }
}

@Component({
  selector: 'app-login',
  imports: [AuthLayout, RouterLink],
  template: `
    <app-auth-layout>
      <form class="ob-form" (submit)="submit($event)">
        <span class="ob-form-title">Welcome back</span>
        <div class="field"><label for="email">Email</label><input id="email" class="input" type="email" autocomplete="email" [value]="email()" (input)="email.set(val($event))" /></div>
        <div class="field"><label for="password">Password</label><input id="password" class="input" type="password" autocomplete="current-password" [value]="password()" (input)="password.set(val($event))" /></div>
        @if (error()) { <span class="err">{{ error() }}</span> }
        <button class="btn btn-primary btn-lg" [disabled]="busy()">{{ busy() ? 'Logging in…' : 'Log in' }}</button>
        <span style="font-size: 14px; color: var(--color-neutral-800)">New here? <a routerLink="/signup">Create your garage</a></span>
        <span class="ob-fine">Demo account: j.durand&#64;example.com / Demo1234!</span>
      </form>
    </app-auth-layout>
  `,
})
export class Login {
  private store = inject(Store)
  private nav = inject(Nav)
  protected email = signal('j.durand@example.com')
  protected password = signal('')
  protected error = signal('')
  protected busy = signal(false)
  protected val = (e: Event) => (e.target as HTMLInputElement).value

  protected async submit(e: Event) {
    e.preventDefault()
    this.busy.set(true)
    this.error.set('')
    try {
      await this.store.signIn({ email: this.email(), password: this.password() })
      this.nav.go('/garage')
    } catch (err) {
      this.error.set(errorMessage(err))
    } finally {
      this.busy.set(false)
    }
  }
}

/* 7b */
@Component({
  selector: 'app-tastes',
  imports: [RouterLink],
  template: `
    <div class="ob-screen">
      <div class="ob-top"><span class="ob-brand" style="color: var(--color-text)">MARQUE</span><span class="muted" style="margin-left: auto; font-size: 13px">Step 2 of 3</span></div>
      <div class="ob-title-row">
        <span class="page-title">What do you love?</span>
        <span class="ob-title-note">Pick as many as you like. Your free pack leans toward them.</span>
      </div>
      <div class="split ob-tastes">
        @for (t of tastes; track t.id) {
          @let on = store.tastes().includes(t.id);
          <button class="ob-taste" [class.on]="on" [attr.aria-pressed]="on" (click)="toggle(t.id)">
            <span class="label" style="color: inherit">{{ on ? 'Selected' : 'Select' }}</span>
            <span class="ob-taste-name">{{ t.name }}</span>
            <span style="font-size: 14px">{{ t.examples }}</span>
          </button>
        }
      </div>
      <div class="ob-foot">
        <span style="font-size: 14px; color: var(--color-neutral-800)">{{ store.tastes().length }} selected</span>
        <a routerLink="/welcome/pack" class="btn btn-primary" style="margin-left: auto; padding: 14px 20px; min-width: 240px">Continue</a>
      </div>
    </div>
  `,
})
export class Tastes {
  protected store = inject(Store)
  protected readonly tastes = TASTES
  protected toggle(id: TasteId) {
    this.store.tastes.update(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]))
  }
}

/* 7c */
@Component({
  selector: 'app-first-pack',
  imports: [RouterLink, Photo],
  template: `
    <div class="ob-pack">
      <div class="ob-card" (click)="open()" role="button" tabindex="0" aria-label="Open your starter pack" (keydown.enter)="open()" (keydown.space)="open()">
        <div style="height: 10px" [style.background]="hero() ? TIER_BAR[hero()!.tier] : 'var(--color-accent-700)'"></div>
        <app-photo [car]="hero()" label="car photo · 3/4 front" class="ob-card-photo" />
        @if (hero(); as h) {
          <div class="ob-card-body">
            <span class="label" style="color: inherit; font-weight: 800; font-size: 12px">{{ h.tier }} · New</span>
            <span class="ob-card-model">{{ h.make }} {{ h.model }}</span>
            <span style="font-size: 15px">{{ heroMeta() }}</span>
          </div>
        }
        <div class="ob-cover" [style.transform]="'translateY(' + (opened() ? '-101%' : '0%') + ')'">
          <span class="ob-cover-title">{{ busy() ? 'Opening…' : 'Click to open' }}</span>
          <span style="font-size: 15px; padding-top: 12px">Starter pack · {{ size }} cars</span>
        </div>
      </div>
      <div class="ob-side">
        <span class="muted" style="font-size: 13px">Step 3 of 3</span>
        <span class="ob-side-title">{{ opened() ? 'Welcome to the club.' : 'Open your pack.' }}</span>
        <p style="margin: 0; font-size: 15px; line-height: 24px; color: var(--color-neutral-800)">
          @if (hero(); as h) {
            The {{ h.make }} {{ carLabel(h) }} is now in your garage, along with two more cars. Rarer cars are one pack, one race or one trade away.
          } @else {
            Three cars chosen from the tastes you picked. Odds are the same as the shop.
          }
        </p>
        @if (rest().length) {
          <div class="ob-rest">
            @for (c of rest(); track c.id) {
              <div class="ob-rest-row">
                <span style="width: 6px; align-self: stretch" [style.background]="TIER_BAR[c.tier]"></span>
                <div style="display: flex; flex-direction: column"><span style="font-weight: 800">{{ c.model }}</span><span class="muted" style="font-size: 12px">{{ makeGen(c) }} · {{ c.tier }}</span></div>
              </div>
            }
          </div>
        }
        @if (error()) { <span class="err">{{ error() }}</span> }
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px">
          <a routerLink="/garage" class="btn btn-primary btn-lg">Go to my garage</a>
          <a routerLink="/packs" class="btn btn-secondary btn-lg">Visit the pack shop</a>
        </div>
      </div>
    </div>
  `,
})
export class FirstPack {
  private store = inject(Store)
  protected readonly size = STARTER_PACK_SIZE
  protected TIER_BAR = TIER_BAR
  protected carLabel = carLabel
  protected makeGen = makeGen
  protected busy = signal(false)
  protected error = signal('')
  protected opened = computed(() => !!this.store.starter())
  protected hero = computed(() => { const s = this.store.starter(); return s ? CARS_BY_ID[s[0]] : null })
  protected rest = computed(() => (this.store.starter() ?? []).slice(1).map(id => CARS_BY_ID[id]))
  protected heroMeta = computed(() => {
    const h = this.hero()
    return h ? [h.gen, h.year, `${h.hp} hp`, `${num(h.kg)} kg`].filter(Boolean).join(' · ') : ''
  })

  protected async open() {
    if (this.opened() || this.busy()) return
    this.busy.set(true)
    this.error.set('')
    try { await this.store.completeOnboarding() } catch (e) { this.error.set(errorMessage(e)) } finally { this.busy.set(false) }
  }
}
