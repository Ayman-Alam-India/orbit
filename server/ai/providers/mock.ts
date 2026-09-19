import type { AiProvider } from '../types'

/**
 * Canned but data-aware answers. Works offline with no API key, and is always the
 * fallback when a real provider fails.
 */
export const mockProvider: AiProvider = {
  name: 'mock',

  async generateInsight({ subjectType, subjectId, context }) {
    const top = [...context.events].sort((a, b) => b.severity - a.severity)
    const subjectName =
      subjectType === 'global'
        ? 'the world'
        : subjectType === 'country'
          ? (context.countries[0]?.name ?? subjectId)
          : (context.events[0]?.title ?? subjectId)
    return {
      id: `ins_${subjectType}_${subjectId.toLowerCase()}`,
      subjectType,
      subjectId,
      summary: `Mock insight for ${subjectName}: ${context.events.length} tracked event(s), highest severity ${top[0]?.severity ?? 'n/a'} of 5.`,
      keyPoints: top.length
        ? top.slice(0, 3).map((e) => `${e.title} (severity ${e.severity})`)
        : ['No tracked events for this subject yet.'],
      sourceIds: [...new Set(top.flatMap((e) => e.sourceIds))],
      confidence: 'medium',
      provider: 'mock',
      generatedAt: new Date().toISOString(),
    }
  },

  async ask(request, context) {
    const focus = context.countries[0]?.name ?? context.events[0]?.title ?? 'the world'
    return {
      answer: `Mock answer about ${focus}: you asked "${request.question}". A real AI provider will answer using ${context.events.length} event(s) and ${context.news.length} headline(s) from ORBIT's data.`,
      sourceIds: [...new Set(context.events.flatMap((e) => e.sourceIds))],
      provider: 'mock',
      generatedAt: new Date().toISOString(),
    }
  },
}
