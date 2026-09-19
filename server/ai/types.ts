import type {
  AIInsight,
  AskAnswer,
  AskRequest,
  Country,
  InsightSubjectType,
  NewsHeadline,
  OrbitEvent,
  Source,
} from '@shared'

/** Everything ORBIT knows about a subject. Providers put this into the prompt (no vector DB). */
export type AiContext = {
  countries: Country[]
  events: OrbitEvent[]
  news: NewsHeadline[]
  sources: Source[]
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
