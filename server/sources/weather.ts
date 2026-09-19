import { WeatherReportSchema, type CountryId, type WeatherReport } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { AppError, notFound } from '../http'
import { readCache, writeCache } from './cache'

/**
 * Weather at a country's capital from Open-Meteo (free, keyless, no sign-up). Live only in
 * DATA_MODE=live; the last good report per country is cached for offline use.
 */
const FRESH_MS = 30 * 60_000
const TIMEOUT_MS = 8_000

/** WMO weather interpretation codes → short labels. */
const WMO: [number[], string][] = [
  [[0], 'Clear sky'],
  [[1, 2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67], 'Rain'],
  [[71, 73, 75, 77], 'Snow'],
  [[80, 81, 82], 'Rain showers'],
  [[85, 86], 'Snow showers'],
  [[95, 96, 99], 'Thunderstorm'],
]
export const describeWeatherCode = (code: number) =>
  WMO.find(([codes]) => codes.includes(code))?.[1] ?? 'Unknown'

type OpenMeteo = {
  current: {
    temperature_2m: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
  }
}

async function fetchOpenMeteo(countryId: CountryId): Promise<WeatherReport> {
  const country = store.getCountry(countryId)
  if (!country) throw notFound(`Country "${countryId}"`)
  const { lat, lng } = country.centroid
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    forecast_days: '7',
    timezone: 'UTC',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
  const body = (await res.json()) as OpenMeteo
  return WeatherReportSchema.parse({
    countryId,
    place: country.capital,
    location: { lat, lng },
    current: {
      temperatureC: body.current.temperature_2m,
      precipitationMm: body.current.precipitation,
      windKmh: body.current.wind_speed_10m,
      weatherCode: body.current.weather_code,
      description: describeWeatherCode(body.current.weather_code),
    },
    daily: body.daily.time.map((date, i) => ({
      date: `${date}T00:00:00Z`,
      maxC: body.daily.temperature_2m_max[i],
      minC: body.daily.temperature_2m_min[i],
      precipitationMm: body.daily.precipitation_sum[i],
    })),
    asOf: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    sourceId: 'src_open_meteo',
  })
}

type CachedWeather = { fetchedAt: number; report: WeatherReport }

export async function getWeather(countryId: CountryId): Promise<WeatherReport> {
  if (!store.getCountry(countryId)) throw notFound(`Country "${countryId}"`)
  const key = `weather-${countryId}`
  const cached = await readCache<CachedWeather>(key)
  const cachedReport = WeatherReportSchema.safeParse(cached?.report)
  const fresh = cached && Date.now() - cached.fetchedAt < FRESH_MS

  if (env.DATA_MODE === 'mock' || fresh) {
    if (cachedReport.success) return cachedReport.data
    throw new AppError('UPSTREAM', 503, 'Live weather is off (set DATA_MODE=live to fetch it)')
  }
  try {
    const report = await fetchOpenMeteo(countryId)
    await writeCache(key, { fetchedAt: Date.now(), report } satisfies CachedWeather)
    return report
  } catch (err) {
    if (err instanceof AppError) throw err
    console.warn(
      `[sources] weather for ${countryId} failed:`,
      err instanceof Error ? err.message : err,
    )
    if (cachedReport.success) return cachedReport.data
    throw new AppError('UPSTREAM', 503, 'Weather is unavailable right now')
  }
}
