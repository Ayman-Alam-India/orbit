import type { NewsHeadline, OrbitEventKind } from '@shared'

/**
 * The offline classifier: turns a headline into a candidate event with no AI and no network.
 * It is the fallback when Gemini is unavailable, and it is what the tests run against, so event
 * detection works even with the wifi off. Keyword lists are deliberately narrow: a headline that
 * matches nothing is skipped rather than guessed at.
 */

type Rule = { kind: OrbitEventKind; label: string; severity: number; words: string[] }

/**
 * Whole-word matching. Plain `includes` is a trap here: "Anwar" contains "war" and "deadline" contains
 * "dead", which is how a breakfast meeting once became a severity-4 conflict.
 */
const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const hasTerm = (text: string, term: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(term.trim().toLowerCase())}([^a-z0-9]|$)`).test(
    text.toLowerCase(),
  )

const RULES: Rule[] = [
  {
    kind: 'health',
    label: 'outbreak',
    severity: 4,
    words: [
      'outbreak',
      'epidemic',
      'pandemic',
      'ebola',
      'cholera',
      'measles',
      'dengue',
      'malaria',
      'polio',
      'infections',
      'virus',
      'cases surge',
    ],
  },
  {
    kind: 'geopolitical',
    label: 'conflict',
    severity: 4,
    words: [
      'strike',
      'strikes',
      'attack',
      'attacks',
      'missile',
      'drone',
      'shelling',
      'offensive',
      'troops',
      'militants',
      'clashes',
      'ceasefire',
      'seized',
      'struck',
      'explosion',
      'blast',
      'bombing',
      'gunmen',
    ],
  },
  {
    kind: 'geopolitical',
    label: 'security',
    severity: 3,
    words: [
      'sanctions',
      'blockade',
      'shipping lane',
      'chokepoint',
      'strait',
      'hijack',
      'piracy',
      'evacuation',
      'coup',
      'protests',
      'unrest',
      'war crimes',
    ],
  },
  {
    kind: 'geopolitical',
    label: 'diplomacy',
    severity: 2,
    words: [
      'summit',
      'talks',
      'agreement',
      'treaty',
      'accord',
      'visit',
      'meeting',
      'signed',
      'deal',
      'negotiations',
    ],
  },
  {
    kind: 'geopolitical',
    label: 'economy',
    severity: 2,
    words: [
      'tariff',
      'tariffs',
      'trade',
      'export ban',
      'inflation',
      'interest rate',
      'central bank',
      'oil price',
      'crude',
      'currency',
      'gdp',
    ],
  },
  {
    kind: 'geopolitical',
    label: 'disaster',
    severity: 3,
    words: [
      'earthquake',
      'flood',
      'floods',
      'cyclone',
      'hurricane',
      'typhoon',
      'wildfire',
      'drought',
      'landslide',
      'heatwave',
    ],
  },
]

/** Words that push a matched headline one step up the severity scale. */
const ESCALATORS = [
  'killed',
  'dead',
  'deaths',
  'emergency',
  'mass',
  'thousands',
  'collapse',
  'crisis',
  'record',
]

/**
 * Words that tie a headline to a country. GDELT's per-country search is loose, so a headline is only
 * accepted for a country when it actually names it (or its capital, people or leader's seat).
 * Falls back to the country's own name and capital for anything not listed.
 */
const COUNTRY_TERMS: Record<string, string[]> = {
  USA: ['united states', 'u.s.', 'us', 'usa', 'america', 'american', 'washington', 'white house'],
  CHN: ['china', 'chinese', 'beijing'],
  IND: ['india', 'indian', 'delhi', 'mumbai'],
  RUS: ['russia', 'russian', 'moscow', 'kremlin'],
  UKR: ['ukraine', 'ukrainian', 'kyiv', 'kiev'],
  YEM: ['yemen', 'yemeni', 'houthi', 'houthis', 'sanaa', 'red sea'],
  SAU: ['saudi', 'riyadh', 'aramco'],
  COD: ['congo', 'congolese', 'kinshasa', 'drc'],
  UGA: ['uganda', 'ugandan', 'kampala'],
  FRA: ['france', 'french', 'paris'],
  DEU: ['germany', 'german', 'berlin'],
  ITA: ['italy', 'italian', 'rome'],
  LBR: ['liberia', 'liberian', 'monrovia'],
  KOS: ['kosovo', 'kosovar', 'pristina'],
  NZL: ['new zealand', 'wellington'],
}

/** True when the headline names the country it was filed under. */
export function mentionsCountry(
  title: string,
  country: { id: string; name: string; capital: string },
) {
  const text = title.toLowerCase()
  const terms = COUNTRY_TERMS[country.id] ?? [country.name, country.capital]
  return terms.some((term) => hasTerm(text, term))
}

/** Headlines that are never events: market commentary, listicles, history columns. */
const NOT_NEWS = [
  'today in history',
  'financial analysis',
  'stock forecast',
  'shares of',
  'price target',
  'analyst',
  'opinion:',
  'review:',
  'how to',
  'best of',
]

export const isNotNews = (title: string) =>
  NOT_NEWS.some((phrase) => title.toLowerCase().includes(phrase))

export type Candidate = {
  kind: OrbitEventKind
  label: string
  severity: number
  title: string
  headlines: NewsHeadline[]
}

const clampSeverity = (n: number) => Math.min(5, Math.max(1, n))

/**
 * Groups headlines that describe the same story (same rule, overlapping significant words) and returns
 * one candidate per group, strongest first. `title` is the headline itself: nothing is invented here.
 */
export function classifyHeadlines(headlines: NewsHeadline[]): Candidate[] {
  const candidates: Candidate[] = []
  for (const headline of headlines) {
    const text = headline.title.toLowerCase()
    if (isNotNews(headline.title)) continue
    const rule = RULES.find((r) => r.words.some((w) => hasTerm(text, w)))
    if (!rule) continue
    const severity = clampSeverity(
      rule.severity + (ESCALATORS.some((w) => hasTerm(text, w)) ? 1 : 0),
    )
    const words = new Set(significantWords(headline.title))
    const existing = candidates.find(
      (c) => c.label === rule.label && overlap(new Set(significantWords(c.title)), words) >= 2,
    )
    if (existing) {
      existing.headlines.push(headline)
      existing.severity = Math.max(existing.severity, severity)
      continue
    }
    candidates.push({
      kind: rule.kind,
      label: rule.label,
      severity,
      title: headline.title,
      headlines: [headline],
    })
  }
  return candidates.sort(
    (a, b) => b.severity - a.severity || b.headlines.length - a.headlines.length,
  )
}

const STOP = new Set(
  'the a an and or of for to in on at by with from as is are was were be been after before over under new says said report reports amid into its his her their this that than then'.split(
    ' ',
  ),
)

export function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
}

function overlap(a: Set<string>, b: Set<string>) {
  let n = 0
  for (const word of a) if (b.has(word)) n++
  return n
}

/**
 * True when every number in `text` also appears in the headlines it came from (no invented figures).
 * Digits are compared without separators, because wires write the same figure as "7,000" and "7, 000".
 */
export function numbersGrounded(text: string, headlines: NewsHeadline[]): boolean {
  const digits = (s: string) => (s.match(/\d[\d,.\s]*/g) ?? []).map((n) => n.replace(/\D/g, ''))
  const evidence = digits(headlines.map((h) => h.title).join(' '))
  return digits(text).every((n) => evidence.includes(n))
}
