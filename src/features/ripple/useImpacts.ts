import { API_ROUTES, type CountryId, type EventId, type ImpactLink } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const impactKeys = {
  list: (filter: { eventId?: EventId; countryId?: CountryId }) =>
    ['impact', filter.eventId ?? 'any', filter.countryId ?? 'any'] as const,
}

/** Ripple links: all of them, those caused by an event, or those touching a country. */
export const useImpacts = (filter: { eventId?: EventId; countryId?: CountryId } = {}) =>
  useQuery({
    queryKey: impactKeys.list(filter),
    queryFn: () => apiGet<ImpactLink[]>(API_ROUTES.impacts(filter)),
    staleTime: 10 * 60_000,
  })
