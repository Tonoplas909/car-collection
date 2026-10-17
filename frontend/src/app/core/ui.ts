import { DestroyRef, Injectable, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { wipe } from './motion'

const MOBILE = '(max-width: 767px)'

/** Phone layout (the 390 px designs) below 768 px. Screens branch on `mobile()`. */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private mq = matchMedia(MOBILE)
  readonly mobile = signal(this.mq.matches)
  constructor() {
    this.mq.addEventListener('change', e => this.mobile.set(e.matches))
  }
}

/** router.navigateByUrl() behind the page-change wipe. */
@Injectable({ providedIn: 'root' })
export class Nav {
  private router = inject(Router)
  go(url: string, opts?: { replace?: boolean }) {
    wipe(() => void this.router.navigateByUrl(url, { replaceUrl: opts?.replace }))
  }
  /** Without the wipe (back buttons, in-place changes). */
  now(url: string) {
    void this.router.navigateByUrl(url)
  }
}

/** Current time as a signal, refreshed every `ms` while the component lives. Call in an injection context. */
export function clockSignal(ms = 1000) {
  const now = signal(Date.now())
  const t = setInterval(() => now.set(Date.now()), ms)
  inject(DestroyRef).onDestroy(() => clearInterval(t))
  return now
}
