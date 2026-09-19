import { API_ROUTES, type InsightSubjectType, type VerificationReport } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const verificationKeys = {
  subject: (subjectType: InsightSubjectType, subjectId: string) =>
    ['verification', subjectType, subjectId] as const,
}

/** Claim-by-claim check of the insight for a subject. Only fetched when `enabled` (the user asked). */
export const useVerification = (
  subjectType: InsightSubjectType,
  subjectId: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: verificationKeys.subject(subjectType, subjectId),
    queryFn: () => apiGet<VerificationReport>(API_ROUTES.verify(subjectType, subjectId)),
    enabled,
    staleTime: 10 * 60_000,
  })
