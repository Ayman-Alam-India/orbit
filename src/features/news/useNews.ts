import {
  API_ROUTES,
  type CountryId,
  type HealthStatus,
  type NewsHeadline,
  type NewsRefreshResult,
} from '@shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/client'

export const newsKeys = {
  list: (countryId?: CountryId) => ['news', countryId ?? 'all'] as const,
  dataMode: ['news', 'dataMode'] as const,
}

/** The server keeps every feed fresh in the background; the panel picks up new headlines this often. */
export const NEWS_POLL_MS = 2 * 60_000

/** Headlines, newest first. Without a countryId: all headlines. Updates itself while on screen. */
export const useNews = (countryId?: CountryId) =>
  useQuery({
    queryKey: newsKeys.list(countryId),
    queryFn: () => apiGet<NewsHeadline[]>(API_ROUTES.news(countryId)),
    refetchInterval: NEWS_POLL_MS,
  })

/** "mock" or "live": the refresh button only works when the server fetches live news. */
export const useDataMode = () =>
  useQuery({
    queryKey: newsKeys.dataMode,
    queryFn: () => apiGet<HealthStatus>(API_ROUTES.health),
    select: (health) => health.dataMode,
    staleTime: Infinity,
  })

/**
 * The refresh button: asks the server for fresh live headlines and waits for them. The old
 * headlines stay on screen meanwhile, then the answer replaces them in the news list.
 */
export function useRefreshNews(countryId?: CountryId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<NewsRefreshResult>(API_ROUTES.newsRefresh, { countryId }),
    onSuccess: (result) => queryClient.setQueryData(newsKeys.list(countryId), result.headlines),
  })
}
