import type { Severity } from '@shared'

/** Reads a design token at runtime, for code that can't use CSS (e.g. the WebGL globe). */
export function cssVar(name: `--${string}`): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const severityColor = (severity: Severity) => cssVar(`--severity-${severity}`)
