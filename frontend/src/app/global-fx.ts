import { Component, DestroyRef, inject } from '@angular/core'
import { Router } from '@angular/router'
import { EASE, reduced, wipe } from './core/motion'

/**
 * Global interaction effects from the design's fx.js: page-change wipe on internal links,
 * button click sweep, magnetic primary buttons.
 */
@Component({ selector: 'app-global-fx', template: '' })
export class GlobalFx {
  constructor() {
    const router = inject(Router)

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return
      if (a.origin !== window.location.origin || a.hasAttribute('download')) return
      if ((a.getAttribute('href') ?? '').startsWith('#')) return
      if (a.pathname === window.location.pathname && !a.search) return
      if (reduced()) return
      // Capture phase: routerLink never sees the click, the router navigates once the slab covers the page.
      e.preventDefault()
      e.stopPropagation()
      wipe(() => void router.navigateByUrl(a.pathname + a.search + a.hash))
    }

    let magnet: HTMLElement | null = null
    const onDown = (e: PointerEvent) => {
      if (reduced()) return
      const b = (e.target as Element | null)?.closest?.('.btn,button') as HTMLButtonElement | null
      if (!b || b.disabled) return
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative'
      const prev = b.style.overflow
      b.style.overflow = 'hidden'
      const x = document.createElement('span')
      x.style.cssText = 'position:absolute;inset:0;background:currentColor;opacity:.22;pointer-events:none'
      b.appendChild(x)
      x.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(101%)' }], { duration: 480, easing: EASE }).onfinish = () => {
        x.remove()
        b.style.overflow = prev
      }
    }
    const onMove = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.('.btn-primary') as HTMLElement | null
      if (magnet && magnet !== b) { magnet.style.translate = ''; magnet = null }
      if (!b || e.pointerType !== 'mouse' || reduced()) return
      const r = b.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height
      b.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`
      magnet = b
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointermove', onMove, { passive: true })
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointermove', onMove)
    })
  }
}
