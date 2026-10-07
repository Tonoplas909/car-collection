import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EASE, reduced, wipe } from '../lib/motion'

/**
 * Global interaction effects from the design's fx.js:
 * page-change wipe on internal links, button click sweep, magnetic primary buttons.
 */
export function GlobalFx() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return
      if (a.origin !== window.location.origin || a.hasAttribute('download')) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('#')) return
      if (a.pathname === window.location.pathname) return
      if (reduced()) return
      e.preventDefault()
      e.stopPropagation()
      const base = import.meta.env.BASE_URL.replace(/\/$/, '')
      wipe(() => navigate(a.pathname.slice(base.length) + a.search + a.hash))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate])

  useEffect(() => {
    if (reduced()) return
    let magnet: HTMLElement | null = null
    const onDown = (e: PointerEvent) => {
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
      if (!b || e.pointerType !== 'mouse') return
      const r = b.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height
      b.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`
      magnet = b
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointermove', onMove)
    }
  }, [])

  // Each route starts at the top.
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  return null
}
