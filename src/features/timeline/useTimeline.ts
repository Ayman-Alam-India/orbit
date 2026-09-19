import { API_ROUTES, type CountryId, type TimelineEvent } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const timelineKeys = {
  country: (id: CountryId) => ['timeline', id] as const,
}

/** A country's history, oldest first. */
export const useTimeline = (countryId: CountryId) =>
  useQuery({
    queryKey: timelineKeys.country(countryId),
    queryFn: () => apiGet<TimelineEvent[]>(API_ROUTES.countryTimeline(countryId)),
  })
