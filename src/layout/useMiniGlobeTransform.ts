import { useEffect, useState, type CSSProperties } from 'react'
import { MINI_GLOBE_DIAMETER_RATIO } from '../globe/miniGlobe'
import { cssVar } from '../styles/cssVar'

/**
 * CSS variables that squeeze the full-screen globe into the bottom-left mini globe:
 * translate the viewport centre onto the mini globe's centre, scale the globe's diameter down
 * to --mini-globe-size, and clip everything outside the circle. Recomputed on resize.
 */
export function useMiniGlobeTransform(): CSSProperties {
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const size = parseFloat(cssVar('--mini-globe-size')) || 220
  const gutter = parseFloat(cssVar('--space-5')) || 24
  const globeDiameter = viewport.height * MINI_GLOBE_DIAMETER_RATIO
  const scale = size / globeDiameter
  const dx = gutter + size / 2 - viewport.width / 2
  const dy = viewport.height - gutter - size / 2 - viewport.height / 2

  return {
    '--mini-x': `${dx}px`,
    '--mini-y': `${dy}px`,
    '--mini-scale': String(scale),
    // Slightly larger than the globe so the atmosphere glow stays visible.
    '--mini-clip': `${(globeDiameter / 2) * 1.12}px`,
  } as CSSProperties
}
