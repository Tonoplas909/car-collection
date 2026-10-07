import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { wipe } from './motion'

const MOBILE = '(max-width: 767px)'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    cb => {
      const m = matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

/** Phone layout (the 390 px designs) below 768 px. */
export const useIsMobile = () => useMediaQuery(MOBILE)

/** Current time, refreshed every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** navigate() behind the page-change wipe. */
export function useWipeNavigate() {
  const navigate = useNavigate()
  return useCallback((to: string, opts?: { replace?: boolean }) => wipe(() => navigate(to, opts)), [navigate])
}
