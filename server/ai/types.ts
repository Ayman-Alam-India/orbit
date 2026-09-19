import type {
  AIInsight,
  AskAnswer,
  AskRequest,
  Country,
  ImpactLink,
  InsightSubjectType,
  MarketQuote,
  NewsHeadline,
  OrbitEvent,
  SimulationResult,
  Source,
} from '@shared'

/** Everything ORBIT knows about a subject. Providers put this into the prompt (no vector DB). */
export type AiContext = {
  countries: Country[]
  events: OrbitEvent[]
  news: NewsHeadline[]
  sources: Source[]
  /** Ripple effects touching the subject, and the market figures they point to. */
  impacts: ImpactLink[]
  markets: MarketQuote[]
  /** Set when the user asks from the what-if simulator. */
  simulation?: SimulationResult
}

export type InsightRequest = {
  subjectType: InsightSubjectType
  subjectId: string
  context: AiContext
}

/** Every AI backend implements this. Output must match the shared schemas. */
export interface AiProvider {
  name: string
  generateInsight(request: InsightRequest): Promise<AIInsight>
  ask(request: AskRequest, context: AiContext): Promise<AskAnswer>
}
