/**
 * Shared numbers for the "mini globe" (detail views). Kept out of OrbitGlobe.tsx so the layout can use them
 * without loading three.js.
 */

/** Camera altitude (in globe radii) used in detail views, so the whole globe fits in the mini globe. */
export const MINI_GLOBE_ALTITUDE = 2.2

/**
 * On-screen diameter of the globe at MINI_GLOBE_ALTITUDE, as a fraction of the canvas height.
 * Derived from the default three.js camera (fov 50°): tan(asin(1 / 3.2)) / tan(25°) ≈ 0.705.
 */
export const MINI_GLOBE_DIAMETER_RATIO = 0.705

/** Slow auto-rotation of the mini globe (OrbitControls units). */
export const MINI_GLOBE_ROTATE_SPEED = 0.6
