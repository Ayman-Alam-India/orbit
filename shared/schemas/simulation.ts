import { z } from 'zod'
import { CountryIdSchema, IsoDateTimeSchema, LatLngSchema, SourceIdSchema } from './common'

/**
 * What-if simulator. The user picks a scenario and the size of the oil-price shock; ORBIT does
 * transparent arithmetic on sourced and live numbers. A simulation is never a forecast.
 */
export const ScenarioIdSchema = z
  .string()
  .regex(/^scn_[a-z0-9_]+$/, 'Scenario IDs look like "scn_hormuz_closure"')

export const ScenarioRoleSchema = z.enum(['exporter', 'importer', 'transit'])

export const ScenarioSchema = z.object({
  id: ScenarioIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  /** The chokepoint the scenario is about; the globe flies here and draws arcs from it. */
  chokepoint: z.object({ name: z.string().min(1), location: LatLngSchema }),
  /** Suggested Brent shock in percent (illustrative, the user can change it). */
  defaultBrentPct: z.number(),
  /** Sourced facts shown with the scenario. */
  facts: z.array(z.object({ text: z.string().min(1), sourceIds: z.array(SourceIdSchema).min(1) })),
  /** Oil flow through the chokepoint and pipeline bypass capacity (million barrels/day), when known. */
  flow: z
    .object({
      millionBarrelsPerDay: z.number().positive(),
      bypassMillionBarrelsPerDay: z.number().min(0),
      shareOfWorldConsumptionPct: z.number().positive(),
      sourceIds: z.array(SourceIdSchema).min(1),
    })
    .optional(),
  affected: z.array(
    z.object({
      countryId: CountryIdSchema,
      role: ScenarioRoleSchema,
      note: z.string().min(1),
      sourceIds: z.array(SourceIdSchema).min(1),
    }),
  ),
})

/** One derived number: always with the formula that produced it and the sources of its inputs. */
export const SimulatedImpactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Pre-formatted headline value, e.g. "+₹17.9 /l". */
  value: z.string().min(1),
  detail: z.string().min(1),
  formula: z.string().min(1),
  /** simulation = arithmetic on the chosen shock · analysis = ORBIT's qualitative reasoning. */
  basis: z.enum(['simulation', 'analysis']),
  sourceIds: z.array(SourceIdSchema),
})

export const SimulationResultSchema = z.object({
  scenario: ScenarioSchema,
  brentPct: z.number(),
  brent: z.object({ from: z.number(), to: z.number(), asOf: IsoDateTimeSchema, live: z.boolean() }),
  impacts: z.array(SimulatedImpactSchema),
  generatedAt: IsoDateTimeSchema,
})

export type ScenarioId = z.infer<typeof ScenarioIdSchema>
export type ScenarioRole = z.infer<typeof ScenarioRoleSchema>
export type Scenario = z.infer<typeof ScenarioSchema>
export type SimulatedImpact = z.infer<typeof SimulatedImpactSchema>
export type SimulationResult = z.infer<typeof SimulationResultSchema>
