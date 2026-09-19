import { API_ROUTES, type Country, type CountryId, type OrbitEvent } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

// Query keys start with the feature name so features never collide.
export const countryKeys = {
  all: ['country'] as const,
  detail: (id: CountryId) => ['country', id] as const,
  events: (id: CountryId) => ['country', id, 'events'] as const,
}

export const useCountries = () =>
  useQuery({ queryKey: countryKeys.all, queryFn: () => apiGet<Country[]>(API_ROUTES.countries) })

export const useCountry = (id: CountryId) =>
  useQuery({
    queryKey: countryKeys.detail(id),
    queryFn: () => apiGet<Country>(API_ROUTES.country(id)),
  })

export const useCountryEvents = (id: CountryId) =>
  useQuery({
    queryKey: countryKeys.events(id),
    queryFn: () => apiGet<OrbitEvent[]>(API_ROUTES.countryEvents(id)),
  })
