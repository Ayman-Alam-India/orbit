import type { Country, CountryId, IsoDateTime } from '@shared'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "17 Sep 2026" (UTC, like the data). Built by hand because locales disagree on month
 * abbreviations (en-GB gives "Sept"), and the demo should look the same on every laptop.
 */
export const formatDate = (iso: IsoDateTime, precision: 'day' | 'month' | 'year' = 'day') => {
  const d = new Date(iso)
  const year = String(d.getUTCFullYear())
  if (precision === 'year') return year
  const month = `${MONTHS[d.getUTCMonth()]} ${year}`
  return precision === 'month' ? month : `${d.getUTCDate()} ${month}`
}

/** 1450000000 → "1.45B". */
export const formatPopulation = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value)

/** ["IND", "USA"] → "India, United States" (falls back to the ID when a country isn't loaded). */
export const countryNames = (ids: CountryId[], countries: Country[] = []) =>
  ids.map((id) => countries.find((c) => c.id === id)?.name ?? id).join(', ')

/** "Al Jazeera: Former Kosovo President… (16 Sep 2026)" → "Al Jazeera" (the full name stays available as a tooltip). */
export const shortSourceName = (name: string) => name.split(':')[0].trim()
