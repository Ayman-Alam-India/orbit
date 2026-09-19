import type { OrbitEvent } from '@shared'
import { describe, expect, it } from 'vitest'
import { needsRing, pinAltitude, ringColor, ringMaxRadius, tooltipHtml } from './globeStyle'

const event = (severity: OrbitEvent['severity']) => ({ severity }) as OrbitEvent

describe('globe style helpers', () => {
  it('pins get taller with severity but stay short', () => {
    expect(pinAltitude(5)).toBeGreaterThan(pinAltitude(1))
    expect(pinAltitude(5)).toBeLessThan(0.1)
  })

  it('only severity 4 and 5 get ripple rings', () => {
    expect([1, 2, 3, 4, 5].map((s) => needsRing(event(s)))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    expect(ringMaxRadius(5)).toBeGreaterThan(ringMaxRadius(4))
  })

  it('rings fade out as they grow', () => {
    const colour = ringColor('255, 106, 0')
    expect(colour(0)).toBe('rgba(255, 106, 0, 1.000)')
    expect(colour(1)).toBe('rgba(255, 106, 0, 0.000)')
  })

  it('tooltips escape HTML from data', () => {
    expect(tooltipHtml('<b>x</b>')).not.toContain('<b>')
    expect(tooltipHtml('India', 'Severity 3/5')).toContain('<span>Severity 3/5</span>')
  })
})
