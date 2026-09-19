import type { AIInsight } from '@shared'

/** Keep the check focused: long insights are cut to this many claims. */
export const MAX_CLAIMS = 6

/**
 * Splits an insight into individual, checkable claims: each sentence of the summary plus each
 * key point. Very short fragments and duplicates are dropped.
 */
export function extractClaims(insight: AIInsight, max = MAX_CLAIMS): string[] {
  const sentences = insight.summary.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((s) => s.trim())
  const seen = new Set<string>()
  const claims: string[] = []
  for (const text of [...sentences, ...insight.keyPoints.map((p) => p.trim())]) {
    const key = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    if (text.length < 12 || seen.has(key)) continue
    seen.add(key)
    claims.push(text)
  }
  return claims.slice(0, max)
}
