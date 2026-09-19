import { z } from 'zod'
import { CountryIdSchema, LatLngSchema, SeveritySchema } from './common'

export const CountrySchema = z.object({
  id: CountryIdSchema,
  name: z.string().min(1),
  region: z.string().min(1),
  capital: z.string().min(1),
  /** Where the globe camera flies to when the country is selected. */
  centroid: LatLngSchema,
  population: z.number().int().positive(),
  summary: z.string().min(1),
  /** Overall risk right now, on the shared 1–5 severity scale. */
  riskLevel: SeveritySchema,
})

export type Country = z.infer<typeof CountrySchema>
