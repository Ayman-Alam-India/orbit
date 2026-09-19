import { z } from 'zod'
import { CountryIdSchema, IsoDateTimeSchema, LatLngSchema, SourceIdSchema } from './common'

/** Current conditions and a short forecast at a country's capital (Open-Meteo, free and keyless). */
export const WeatherReportSchema = z.object({
  countryId: CountryIdSchema,
  /** Where the reading is for, e.g. "Kinshasa". */
  place: z.string().min(1),
  location: LatLngSchema,
  current: z.object({
    temperatureC: z.number(),
    precipitationMm: z.number(),
    windKmh: z.number(),
    /** WMO weather code (0 clear … 99 thunderstorm). */
    weatherCode: z.number().int(),
    description: z.string().min(1),
  }),
  /** Next days, earliest first. */
  daily: z.array(
    z.object({
      date: IsoDateTimeSchema,
      maxC: z.number(),
      minC: z.number(),
      precipitationMm: z.number(),
    }),
  ),
  asOf: IsoDateTimeSchema,
  sourceId: SourceIdSchema,
})

export type WeatherReport = z.infer<typeof WeatherReportSchema>
