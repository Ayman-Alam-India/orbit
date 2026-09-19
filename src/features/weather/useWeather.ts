import { API_ROUTES, type CountryId, type WeatherReport } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const weatherKeys = { country: (id: CountryId) => ['weather', id] as const }

/** Weather at a country's capital. Fails with code UPSTREAM when live data is off or unavailable. */
export const useWeather = (countryId: CountryId) =>
  useQuery({
    queryKey: weatherKeys.country(countryId),
    queryFn: () => apiGet<WeatherReport>(API_ROUTES.weather(countryId)),
    staleTime: 15 * 60_000,
    retry: false,
  })
