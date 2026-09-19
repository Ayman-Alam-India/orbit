import { z } from 'zod'
import { CountryIdSchema, IsoDateTimeSchema, SourceIdSchema } from './common'

export const MarketIdSchema = z
  .string()
  .regex(/^mkt_[a-z0-9_]+$/, 'Market IDs look like "mkt_brent"')
export const MarketKindSchema = z.enum(['index', 'stock', 'commodity', 'fx', 'fuel'])

/** One price point (daily close). */
export const PricePointSchema = z.object({ date: IsoDateTimeSchema, value: z.number() })

/** A market figure ORBIT tracks: an index, stock, commodity, exchange rate or retail fuel price. */
export const MarketQuoteSchema = z.object({
  id: MarketIdSchema,
  name: z.string().min(1),
  kind: MarketKindSchema,
  /** Ticker used for live updates (Yahoo Finance), if the figure is live-updatable. */
  symbol: z.string().optional(),
  /** The country the figure belongs to, if any (Brent has none). */
  countryId: CountryIdSchema.optional(),
  value: z.number(),
  /** e.g. "USD", "INR". */
  currency: z.string().min(1),
  /** e.g. "per barrel", "per litre", "INR per USD". */
  unit: z.string().optional(),
  /** Previous close, for the daily change. */
  previousClose: z.number().optional(),
  /** Recent daily closes, oldest first (for sparklines). */
  history: z.array(PricePointSchema).optional(),
  asOf: IsoDateTimeSchema,
  sourceId: SourceIdSchema,
  /** true when this value was fetched live in this session; false = the curated snapshot. */
  live: z.boolean(),
})

export type MarketId = z.infer<typeof MarketIdSchema>
export type MarketKind = z.infer<typeof MarketKindSchema>
export type MarketQuote = z.infer<typeof MarketQuoteSchema>
