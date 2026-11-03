import {
  ImpactLinkSchema,
  type Country,
  type CountryId,
  type ImpactChannel,
  type ImpactDirection,
  type ImpactLink,
  type NewsHeadline,
  type OrbitEvent,
} from '@shared'
import { createHash } from 'node:crypto'
import { GOOGLE_NEWS_SOURCE_ID, searchGoogleNews } from '../sources/googleNews'
import { hasTerm } from './classify'

/**
 * Automatic ripple effects. Fixed, readable rules say which countries and markets depend on a
 * channel (an oil chokepoint, a shipping lane, chip supply, Black Sea grain, a border for an
 * outbreak). Every rule-made link is ORBIT's analysis (basis "analysis"); ORBIT then searches the
 * news for reports of that effect and attaches them as evidence, which the trust rule then rates.
 */

type Target = {
  /** A country ID, or a market ID (mkt_...). */
  id: string
  channel: ImpactChannel
  direction: ImpactDirection
  strength: 1 | 2 | 3
  effect: string
  mechanism: string
}

type Rule = {
  id: string
  /** Any of these in the event's title, summary or tags triggers the rule. */
  words: string[]
  /** Searched together with the target's name to find evidence, e.g. "Red Sea". */
  evidence: string
  targets: Target[]
}

export const RIPPLE_RULES: Rule[] = [
  {
    id: 'red_sea',
    words: ['Red Sea', 'Houthi', 'Houthis', 'Bab el-Mandeb', 'Suez'],
    evidence: 'Red Sea shipping',
    targets: [
      {
        id: 'EGY',
        channel: 'shipping',
        direction: 'down',
        strength: 3,
        effect: 'Lower Suez Canal revenue',
        mechanism:
          'Ships avoiding the Red Sea also skip the Suez Canal, cutting the transit fees Egypt earns.',
      },
      {
        id: 'IND',
        channel: 'shipping',
        direction: 'up',
        strength: 2,
        effect: 'Costlier, slower trade with Europe',
        mechanism:
          "Diverting ships around Africa adds one to two weeks and raises freight costs on India's Europe trade.",
      },
      {
        id: 'CHN',
        channel: 'shipping',
        direction: 'up',
        strength: 2,
        effect: 'Higher freight costs to Europe',
        mechanism:
          "Most Asia–Europe container traffic uses the Red Sea; rerouting raises costs for China's exporters.",
      },
      {
        id: 'DEU',
        channel: 'trade',
        direction: 'up',
        strength: 1,
        effect: 'Slower deliveries from Asia',
        mechanism: 'Longer routes delay parts and goods from Asia for European manufacturers.',
      },
      {
        id: 'mkt_brent',
        channel: 'energy',
        direction: 'up',
        strength: 2,
        effect: 'Pressure on oil prices',
        mechanism:
          'Tankers between the Gulf and Europe use the Red Sea; disruption adds a risk premium to crude.',
      },
    ],
  },
  {
    id: 'hormuz',
    words: ['Strait of Hormuz', 'Hormuz', 'Persian Gulf', 'Gulf of Oman'],
    evidence: 'Strait of Hormuz oil',
    targets: [
      {
        id: 'IND',
        channel: 'energy',
        direction: 'up',
        strength: 3,
        effect: 'Higher crude import bill',
        mechanism:
          'India imports most of its crude, much of it from the Gulf through the Strait of Hormuz.',
      },
      {
        id: 'CHN',
        channel: 'energy',
        direction: 'up',
        strength: 2,
        effect: 'Higher oil import costs',
        mechanism: "A large share of China's crude imports passes through the Strait of Hormuz.",
      },
      {
        id: 'JPN',
        channel: 'energy',
        direction: 'up',
        strength: 2,
        effect: 'Oil and LNG supply risk',
        mechanism: 'Japan imports almost all its oil, most of it from the Middle East via Hormuz.',
      },
      {
        id: 'KOR',
        channel: 'energy',
        direction: 'up',
        strength: 2,
        effect: 'Oil supply risk',
        mechanism: 'South Korea relies on Middle Eastern crude shipped through Hormuz.',
      },
      {
        id: 'QAT',
        channel: 'energy',
        direction: 'risk',
        strength: 3,
        effect: 'LNG exports at risk',
        mechanism: "All of Qatar's LNG exports leave the Gulf through the Strait of Hormuz.",
      },
      {
        id: 'ARE',
        channel: 'energy',
        direction: 'risk',
        strength: 2,
        effect: 'Oil exports at risk',
        mechanism: 'Much of the UAE oil export capacity ships through Hormuz.',
      },
      {
        id: 'mkt_brent',
        channel: 'energy',
        direction: 'up',
        strength: 3,
        effect: 'Oil price spike risk',
        mechanism: 'About a fifth of the world’s oil passes through the Strait of Hormuz.',
      },
    ],
  },
  {
    id: 'taiwan',
    words: ['Taiwan Strait', 'TSMC', 'chip export', 'semiconductor export'],
    evidence: 'Taiwan chips',
    targets: [
      {
        id: 'USA',
        channel: 'trade',
        direction: 'risk',
        strength: 3,
        effect: 'Advanced chip supply at risk',
        mechanism:
          'Most of the world’s most advanced chips are made in Taiwan; US tech firms depend on them.',
      },
      {
        id: 'JPN',
        channel: 'trade',
        direction: 'risk',
        strength: 2,
        effect: 'Electronics supply chain risk',
        mechanism: "Japan's carmakers and electronics firms buy chips made in Taiwan.",
      },
      {
        id: 'KOR',
        channel: 'trade',
        direction: 'risk',
        strength: 2,
        effect: 'Chip market disruption',
        mechanism:
          'South Korea and Taiwan are the two chip hubs; disruption in one shakes prices and supply for the other.',
      },
      {
        id: 'DEU',
        channel: 'trade',
        direction: 'risk',
        strength: 2,
        effect: 'Car industry chip shortage risk',
        mechanism:
          "Germany's carmakers were hit hard by the last chip shortage and still rely on Asian supply.",
      },
    ],
  },
  {
    id: 'black_sea',
    words: ['Black Sea', 'Odesa', 'grain corridor', 'grain deal'],
    evidence: 'Black Sea grain',
    targets: [
      {
        id: 'EGY',
        channel: 'trade',
        direction: 'up',
        strength: 3,
        effect: 'Higher wheat import costs',
        mechanism:
          'Egypt is one of the largest wheat importers, much of it from Russia and Ukraine.',
      },
      {
        id: 'TUR',
        channel: 'trade',
        direction: 'risk',
        strength: 2,
        effect: 'Grain and shipping disruption',
        mechanism:
          'Black Sea shipping passes Türkiye’s straits, and Türkiye mills Russian and Ukrainian wheat.',
      },
      {
        id: 'LBN',
        channel: 'trade',
        direction: 'up',
        strength: 2,
        effect: 'Bread price pressure',
        mechanism: 'Lebanon imports most of its wheat from the Black Sea region.',
      },
      {
        id: 'DEU',
        channel: 'energy',
        direction: 'up',
        strength: 2,
        effect: 'Energy price pressure',
        mechanism:
          'The war keeps European gas and power prices volatile; Germany is the largest industrial user.',
      },
      {
        id: 'POL',
        channel: 'security',
        direction: 'risk',
        strength: 2,
        effect: 'Border security pressure',
        mechanism:
          'Poland borders Ukraine, hosts many refugees and is the main route for Western aid.',
      },
    ],
  },
]

/** Neighbours an outbreak can spread to (countries ORBIT tracks only). */
export const NEIGHBOURS: Partial<Record<CountryId, CountryId[]>> = {
  COD: ['UGA'],
  UGA: ['COD', 'KEN'],
  KEN: ['UGA', 'ETH'],
  ETH: ['KEN', 'SDN'],
  SDN: ['ETH', 'EGY'],
  EGY: ['SDN', 'ISR'],
  NGA: [],
  LBR: [],
  SAU: ['YEM', 'IRQ', 'ARE', 'QAT'],
  YEM: ['SAU'],
  IND: ['PAK', 'BGD', 'CHN'],
  PAK: ['IND', 'AFG', 'IRN'],
  BGD: ['IND', 'MMR'],
  MMR: ['BGD', 'THA', 'CHN'],
  CHN: ['IND', 'MMR', 'VNM', 'PRK', 'RUS'],
  RUS: ['UKR', 'POL', 'CHN'],
  UKR: ['RUS', 'POL'],
  IRN: ['IRQ', 'TUR', 'AFG', 'PAK'],
  IRQ: ['IRN', 'SYR', 'TUR', 'SAU'],
  SYR: ['IRQ', 'TUR', 'LBN', 'ISR'],
  LBN: ['SYR', 'ISR'],
  BRA: ['ARG', 'COL', 'VEN'],
  VEN: ['COL', 'BRA'],
  COL: ['VEN', 'BRA'],
  MEX: ['USA'],
  USA: ['CAN', 'MEX'],
  FRA: ['DEU', 'ITA', 'ESP'],
  DEU: ['FRA', 'POL'],
  ITA: ['FRA'],
}

const eventText = (e: OrbitEvent) => `${e.title} ${e.summary} ${e.tags.join(' ')}`

/**
 * The rules an event triggers: only words that name the channel itself (Hormuz, Red Sea, Black Sea
 * grain…). Which country an event is in is never enough on its own: an election in Russia says
 * nothing about grain.
 */
export function rulesFor(event: OrbitEvent): Rule[] {
  const text = eventText(event)
  return RIPPLE_RULES.filter((r) => r.words.some((w) => hasTerm(text, w)))
}

const ripplesId = (eventId: string, targetId: string) =>
  `imp_auto_${createHash('sha1').update(`${eventId}>${targetId}`).digest('hex').slice(0, 10)}`

export type RippleDraft = { link: ImpactLink; evidenceQuery: string }

/**
 * Rule-made ripple links for some events. A link is skipped when its target is one of the event's
 * own countries, when the team already wrote that link (curated wins), or when the target is unknown.
 */
export function draftRipples(
  events: OrbitEvent[],
  curated: ImpactLink[],
  countries: Country[],
  marketIds: Set<string>,
): RippleDraft[] {
  const drafts: RippleDraft[] = []
  const taken = new Set(curated.map((l) => `${l.eventId}>${l.target.id}`))
  const nameOf = (id: string) => countries.find((c) => c.id === id)?.name
  // A multi-country outbreak report (one WHO signal per country): connect the countries.
  const reportOf = (e: OrbitEvent) => e.tags.find((t) => t.startsWith('who-report:'))
  const partners = new Map<string, CountryId[]>()
  for (const e of events) {
    const report = reportOf(e)
    if (report) partners.set(report, [...(partners.get(report) ?? []), ...e.countryIds])
  }
  for (const event of events) {
    const targets: (Target & { evidence: string })[] = rulesFor(event).flatMap((r) =>
      r.targets.map((t) => ({ ...t, evidence: r.evidence })),
    )
    const report = reportOf(event)
    // Only the report's lead signal (first-named country) draws the links, so each pair is linked once.
    const group = report ? (partners.get(report) ?? []) : []
    if (event.kind === 'health' && report && group[0] === event.countryIds[0]) {
      for (const id of group.slice(1)) {
        targets.push({
          id,
          channel: 'health',
          direction: 'risk',
          strength: 3,
          effect: `Same outbreak: ${event.indicator}`,
          mechanism: `WHO reports the same ${event.indicator} outbreak in ${nameOf(id) ?? id}, so cases are moving between these countries.`,
          evidence: event.indicator,
        })
      }
    }
    if (event.kind === 'health' && event.severity >= 3) {
      for (const id of event.countryIds.flatMap((c) => NEIGHBOURS[c] ?? [])) {
        targets.push({
          id,
          channel: 'health',
          direction: 'risk',
          strength: 2,
          effect: `Cross-border spread risk: ${event.indicator}`,
          mechanism: `Travel and trade across the border can carry ${event.indicator} into ${nameOf(id) ?? id}; neighbours usually step up screening.`,
          evidence: event.indicator,
        })
      }
    }
    for (const t of targets) {
      const isMarket = t.id.startsWith('mkt_')
      if (event.countryIds.includes(t.id as CountryId)) continue
      if (isMarket ? !marketIds.has(t.id) : !nameOf(t.id)) continue
      const key = `${event.id}>${t.id}`
      if (taken.has(key)) continue
      taken.add(key)
      const parsed = ImpactLinkSchema.safeParse({
        id: ripplesId(event.id, t.id),
        eventId: event.id,
        target: isMarket ? { kind: 'market', id: t.id } : { kind: 'country', id: t.id },
        channel: t.channel,
        direction: t.direction,
        strength: t.strength,
        effect: t.effect,
        mechanism: t.mechanism,
        basis: 'analysis',
        sourceIds: [],
        marketId: isMarket ? t.id : undefined,
        origin: 'auto',
      })
      if (!parsed.success) continue
      drafts.push({
        link: parsed.data,
        evidenceQuery: isMarket
          ? `"${t.evidence}" oil price when:7d`
          : `"${t.evidence}" "${nameOf(t.id)}" when:7d`,
      })
    }
  }
  return drafts
}

/** Gap between evidence searches, so Google News sees a gentle trickle. */
export const evidenceSearch = { gapMs: 1_000, max: 40 }

/**
 * Searches the news for each draft's effect and attaches what it finds. Searches are shared
 * between drafts with the same query. A failed search just leaves a link without evidence.
 */
export async function findEvidence(drafts: RippleDraft[]) {
  const results = new Map<string, NewsHeadline[]>()
  for (const q of [...new Set(drafts.map((d) => d.evidenceQuery))].slice(0, evidenceSearch.max)) {
    try {
      results.set(q, await searchGoogleNews(q))
    } catch (err) {
      console.warn(`[ingest] ripple evidence search failed (${q}):`, err)
    }
    await new Promise((resolve) => setTimeout(resolve, evidenceSearch.gapMs))
  }
  return drafts.map((d) => {
    const evidence = (results.get(d.evidenceQuery) ?? []).slice(0, 6)
    const link: ImpactLink = evidence.length
      ? {
          ...d.link,
          sourceIds: [GOOGLE_NEWS_SOURCE_ID],
          evidenceUrls: evidence.map((h) => h.url),
        }
      : d.link
    return { link, evidence }
  })
}
