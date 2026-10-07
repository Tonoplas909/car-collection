// Motion helpers ported from the design's fx.js and per-screen animations.

export const EASE = 'cubic-bezier(.76,0,.24,1)'
export const OUT = 'cubic-bezier(.2,.8,.2,1)'

/** True when the OS asks for reduced motion or the player turned motion off in Settings. */
export function reduced() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true'
}

function run(el: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions) {
  return el?.animate(kf, { fill: 'backwards', ...o })
}

export interface PanelRefs {
  hdr?: HTMLElement | null
  title?: HTMLElement | null
  photo?: HTMLElement | null
  /** Children rise in a 70 ms stagger; a nested bar (last child's first child) fills with scaleX */
  stats?: HTMLElement | null
  /** Children grow with scaleY in a 35 ms stagger */
  hist?: HTMLElement | null
  meta?: HTMLElement | null
}

/** Garage / Market side panel: header wipe, photo wipe, title rise, stats stagger, bars fill. */
export function animatePanel(r: PanelRefs) {
  if (reduced()) return
  run(r.hdr, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, easing: EASE })
  run(r.title, [{ transform: 'translateY(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 240, easing: OUT })
  run(r.photo, [{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 560, delay: 120, easing: EASE })
  Array.from(r.stats?.children ?? []).forEach((el, i) => {
    run(el, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 320 + i * 70, easing: OUT })
    const bar = el.lastElementChild?.firstElementChild
    if (bar?.classList.contains('statbar-fill')) run(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, delay: 420 + i * 70, easing: OUT })
  })
  Array.from(r.hist?.children ?? []).forEach((el, i) => {
    run(el, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 480, delay: 380 + i * 35, easing: OUT })
  })
  run(r.meta, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 520 })
}

/** Race setup: a black slab crosses the element (720 ms). The element needs position:relative and overflow:hidden. */
export function sweep(el: HTMLElement | null | undefined, delay = 0) {
  if (!el || reduced()) return
  const slab = document.createElement('div')
  slab.style.cssText = 'position:absolute;inset:0;background:var(--color-text);z-index:3;pointer-events:none'
  el.appendChild(slab)
  const a = slab.animate(
    [{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)', offset: 0.45 }, { transform: 'translateX(0)', offset: 0.55 }, { transform: 'translateX(101%)' }],
    { duration: 720, delay, easing: EASE, fill: 'both' },
  )
  a.onfinish = () => slab.remove()
  a.oncancel = () => slab.remove()
}

/** Race setup panel entrance after a sweep. */
export function animateRacePanel(r: { hdr?: HTMLElement | null; title?: HTMLElement | null; opps?: HTMLElement | null; rewards?: HTMLElement | null; note?: HTMLElement | null }) {
  if (reduced()) return
  sweep(r.hdr, 60)
  run(r.title, [{ transform: 'translateY(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 560, delay: 380, easing: OUT })
  Array.from(r.opps?.children ?? []).forEach((el, i) =>
    run(el, [{ transform: 'translateX(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 420 + i * 70, easing: OUT }))
  Array.from(r.rewards?.children ?? []).forEach((el, i) =>
    run(el, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 500 + i * 70, easing: OUT }))
  run(r.note, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 640 })
}

let wiping = false

/** Page change wipe: black slab with a red edge covers the screen (420 ms), the page changes, then it leaves (560 ms). */
export function wipe(go: () => void) {
  if (reduced() || wiping) { go(); return }
  wiping = true
  const s = document.createElement('div')
  s.className = 'page-wipe'
  document.body.appendChild(s)
  s.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: EASE, fill: 'forwards' }).onfinish = () => {
    go()
    requestAnimationFrame(() => {
      s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: 560, delay: 60, easing: EASE, fill: 'forwards' }).onfinish = () => {
        s.remove()
        wiping = false
      }
    })
  }
}
