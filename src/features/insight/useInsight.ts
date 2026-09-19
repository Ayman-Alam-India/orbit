import { API_ROUTES, type AIInsight, type InsightSubjectType } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const insightKeys = {
  subject: (subjectType: InsightSubjectType, subjectId: string) =>
    ['insight', subjectType, subjectId] as const,
}

/** The AI explanation for the world, a country or an event. */
export const useInsight = (subjectType: InsightSubjectType, subjectId: string) =>
  useQuery({
    queryKey: insightKeys.subject(subjectType, subjectId),
    queryFn: () => apiGet<AIInsight>(API_ROUTES.insight(subjectType, subjectId)),
    staleTime: 5 * 60_000,
  })
