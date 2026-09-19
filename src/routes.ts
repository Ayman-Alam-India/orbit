import type { CountryId, EventId } from '@shared'

/**
 * Frontend URLs in one place (Global → Country → Event). The selection lives in the URL,
 * so the back button and demo deep-links work. Always build links with these helpers.
 */
export const ROUTE_PATTERNS = {
  global: '/',
  country: '/country/:countryId',
  event: '/country/:countryId/event/:eventId',
} as const

export const paths = {
  global: () => '/',
  country: (countryId: CountryId) => `/country/${countryId}`,
  event: (countryId: CountryId, eventId: EventId) => `/country/${countryId}/event/${eventId}`,
}
