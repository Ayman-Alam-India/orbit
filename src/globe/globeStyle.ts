import type { OrbitEvent, Severity } from '@shared'

/** Events at or above this severity get ripple rings on the globe. */
export const RING_MIN_SEVERITY = 4

/** Pin height above the surface (globe radii): short and gentle, taller for more severe events. */
export const pinAltitude = (severity: Severity) => 0.015 + 0.012 * severity

export const needsRing = (event: OrbitEvent) => event.severity >= RING_MIN_SEVERITY

/** Ring radius in degrees: small, so rings stay neat even when events are close together. */
export const ringMaxRadius = (severity: Severity) => 1.5 + 0.35 * severity

/**
 * Colour function for a ring. `t` goes 0 → 1 over the ring's life; the ring fades out as it grows.
 * `rgbTriplet` is a token like "255, 106, 0" (--globe-ring).
 */
export const ringColor = (rgbTriplet: string) => (t: number) =>
  `rgba(${rgbTriplet}, ${Math.max(0, 1 - t).toFixed(3)})`

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Hover tooltip HTML (the globe library renders labels as HTML strings). Styled by .globe-tooltip in global.css. */
export const tooltipHtml = (title: string, detail?: string) =>
  `<div class="globe-tooltip"><strong>${escapeHtml(title)}</strong>${
    detail ? `<span>${escapeHtml(detail)}</span>` : ''
  }</div>`
