import { API_ROUTES, type CountryId, type NewsHeadline } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const newsKeys = {
  list: (countryId?: CountryId) => ['news', countryId ?? 'all'] as const,
}

/** Headlines, newest first. Without a countryId: all headlines. */
export const useNews = (countryId?: CountryId) =>
  useQuery({
    queryKey: newsKeys.list(countryId),
    queryFn: () => apiGet<NewsHeadline[]>(API_ROUTES.news(countryId)),
  })
