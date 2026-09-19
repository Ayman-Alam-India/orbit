import { API_ROUTES, type CountryId, type MarketQuote } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const marketKeys = {
  list: (countryId?: CountryId) => ['market', countryId ?? 'all'] as const,
}

/** Market figures (live in DATA_MODE=live, otherwise the curated snapshot). Refreshes every 5 min. */
export const useMarkets = (countryId?: CountryId) =>
  useQuery({
    queryKey: marketKeys.list(countryId),
    queryFn: () => apiGet<MarketQuote[]>(API_ROUTES.markets(countryId)),
    refetchInterval: 5 * 60_000,
  })
