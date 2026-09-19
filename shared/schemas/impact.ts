import { z } from 'zod'
import { CountryIdSchema, EventIdSchema, SourceIdSchema } from './common'
import { MarketIdSchema } from './market'

/**
 * Ripple effects: how an event spreads to other countries and markets, e.g. a Red Sea shipping
 * crisis → oil prices → fuel costs in India. Each link is either backed by a cited source or clearly
 * labelled as ORBIT's own analysis.
 */
export const ImpactChannelSchema = z.enum([
  'energy',
  'shipping',
  'trade',
  'finance',
  'health',
  'security',
])

/** up = pushes the target up (prices, cases), down = pushes it down, risk = raises risk without a clear direction. */
export const ImpactDirectionSchema = z.enum(['up', 'down', 'risk'])

/** sourced = a cited source states this link · analysis = ORBIT's reasoning from sourced facts. */
export const ImpactBasisSchema = z.enum(['sourced', 'analysis'])

export const ImpactTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('country'), id: CountryIdSchema }),
  z.object({ kind: z.literal('market'), id: MarketIdSchema }),
])

export const ImpactLinkSchema = z.object({
  id: z.string().regex(/^imp_[a-z0-9_]+$/, 'Impact IDs look like "imp_red_sea_brent"'),
  /** The event that causes the ripple. */
  eventId: EventIdSchema,
  target: ImpactTargetSchema,
  channel: ImpactChannelSchema,
  direction: ImpactDirectionSchema,
  /** 1 = minor, 2 = notable, 3 = major. */
  strength: z.number().int().min(1).max(3),
  /** The effect in a few words, e.g. "Higher crude import bill". */
  effect: z.string().min(1),
  /** How the event causes it, in one or two sentences. */
  mechanism: z.string().min(1),
  basis: ImpactBasisSchema,
  sourceIds: z.array(SourceIdSchema),
  /** A market figure that shows this ripple live (e.g. Brent for an oil-price effect). */
  marketId: MarketIdSchema.optional(),
  /** For chains: the impact this one follows from (e.g. India's fuel bill follows from Brent). */
  followsImpactId: z.string().optional(),
})

export type ImpactChannel = z.infer<typeof ImpactChannelSchema>
export type ImpactDirection = z.infer<typeof ImpactDirectionSchema>
export type ImpactLink = z.infer<typeof ImpactLinkSchema>
