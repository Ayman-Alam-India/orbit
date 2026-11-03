import { HealthSignalSchema, type Country, type HealthSignal } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { readCache, writeCache } from './cache'

/**
 * WHO Disease Outbreak News (free, keyless, official): every new outbreak report becomes a health
 * signal on the globe. WHO is the authority on outbreaks, so these count as verified.
 */
const WHO_API =
  'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=25'
const WHO_ITEM_URL = 'https://www.who.int/emergencies/disease-outbreak-news/item/'
const TIMEOUT_MS = 15_000
/** Older reports are history, not signals. */
const MAX_AGE_MS = 120 * 24 * 60 * 60_000
const CACHE_KEY = 'who-don'

/** Every WHO health signal cites this source (it exists in server/data/seed/sources.json). */
export const WHO_SOURCE_ID = 'src_who_don_live'

type WhoItem = {
  Title?: string
  UrlName?: string
  PublicationDateAndTime?: string
  Summary?: string
  Overview?: string
}

/**
 * WHO's formal country names → ORBIT IDs. Longest names are matched first and removed from the
 * title, so "Democratic People's Republic of Korea" never also matches "Republic of Korea", and
 * "South Sudan" never matches Sudan.
 */
const ALIASES: [string, string | undefined][] = [
  ["Democratic People's Republic of Korea", 'PRK'],
  ['Democratic Republic of the Congo', 'COD'],
  ['United Kingdom of Great Britain and Northern Ireland', 'GBR'],
  ['Venezuela (Bolivarian Republic of)', 'VEN'],
  ['Iran (Islamic Republic of)', 'IRN'],
  ['Islamic Republic of Iran', 'IRN'],
  ['United States of America', 'USA'],
  ['Kingdom of Saudi Arabia', 'SAU'],
  ['Syrian Arab Republic', 'SYR'],
  ['Russian Federation', 'RUS'],
  ['Republic of Korea', 'KOR'],
  ['Republic of the Congo', undefined],
  ['South Sudan', undefined],
  ['Viet Nam', 'VNM'],
  ['Türkiye', 'TUR'],
  ['Turkey', 'TUR'],
]

const SEVERE = /ebola|marburg|plague|nipah|avian influenza|h5n1|lassa|crimean-congo/i

/** Country IDs named in a WHO title, in the order they appear. */
export function countriesInTitle(title: string, countries: Country[]): string[] {
  const found: { id: string; at: number }[] = []
  let text = title
  const names: [string, string | undefined][] = [
    ...ALIASES,
    ...countries.map((c): [string, string] => [c.name, c.id]),
  ].sort((a, b) => b[0].length - a[0].length)
  for (const [name, id] of names) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const m = re.exec(text)
    if (!m) continue
    if (id && !found.some((f) => f.id === id)) found.push({ id, at: m.index })
    text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length)
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.id)
}

/** HTML → plain text, then the first two sentences (max 400 characters). */
function firstSentences(html: string) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .slice(0, 2)
    .join(' ')
  return sentences.length > 400 ? `${sentences.slice(0, 397)}…` : sentences
}

/** WHO reports → health signals. Reports about countries ORBIT doesn't track are skipped. */
export function toHealthSignals(items: WhoItem[], countries: Country[], now = Date.now()) {
  const signals: HealthSignal[] = []
  // WHO posts several updates on one outbreak; reports come newest first, so the first one per
  // disease and country wins and older updates are skipped.
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.Title || !item.UrlName || !item.PublicationDateAndTime) continue
    const published = Date.parse(item.PublicationDateAndTime)
    if (Number.isNaN(published) || now - published > MAX_AGE_MS) continue
    const title = item.Title
    const countryIds = countriesInTitle(title, countries)
    if (!countryIds.length) continue
    // "Disease - Country" or "Disease, Country and Country"
    const indicator = (title.includes(' - ') ? title.split(' - ')[0] : title.split(',')[0]).trim()
    const report = item.UrlName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const summary = firstSentences(item.Summary || item.Overview || '') || title
    // One pin per affected country, so a multi-country outbreak shows everywhere it is.
    // The first-named country carries the report; the others say they are part of it.
    countryIds.forEach((countryId, i) => {
      const country = countries.find((c) => c.id === countryId)
      const key = `${indicator.toLowerCase()}>${countryId}`
      if (!country || seen.has(key)) return
      seen.add(key)
      const parsed = HealthSignalSchema.safeParse({
        kind: 'health',
        id: `hs_who_${report}${i === 0 ? '' : `_${countryId.toLowerCase()}`}`,
        title: i === 0 ? `WHO: ${title}` : `WHO: ${indicator} in ${country.name}`,
        summary:
          i === 0
            ? summary
            : `${country.name} is one of ${countryIds.length} countries in WHO's report "${title}". ${summary}`,
        countryIds: [countryId],
        location: country.centroid,
        occurredAt: new Date(published).toISOString(),
        severity: SEVERE.test(title) ? 4 : 3,
        sourceIds: [WHO_SOURCE_ID],
        tags: ['who', 'outbreak', `who-report:${report}`],
        origin: 'auto',
        detectedAt: new Date(now).toISOString(),
        headlineUrls: [`${WHO_ITEM_URL}${item.UrlName}`],
        indicator,
      })
      if (parsed.success) signals.push(parsed.data as HealthSignal)
    })
  }
  return signals
}

type CachedWho = { fetchedAt: number; signals: HealthSignal[] }

/** Whether the last WHO request worked (for GET /api/status). */
export const whoState = { ok: false }

/**
 * Live mode: the latest WHO outbreak reports as health signals. On any failure the last saved
 * list is used. Mock mode: none (nothing leaves the laptop).
 */
export async function fetchWhoSignals(): Promise<HealthSignal[]> {
  if (env.DATA_MODE === 'mock') return []
  try {
    const res = await fetch(WHO_API, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`WHO responded ${res.status}`)
    const body = (await res.json()) as { value?: WhoItem[] }
    const signals = toHealthSignals(body.value ?? [], store.getCountries())
    await writeCache(CACHE_KEY, { fetchedAt: Date.now(), signals } satisfies CachedWho)
    whoState.ok = true
    return signals
  } catch (err) {
    whoState.ok = false
    console.warn('[sources] WHO outbreak news failed, using the saved list:', err)
    return (await readCache<CachedWho>(CACHE_KEY))?.signals ?? []
  }
}
