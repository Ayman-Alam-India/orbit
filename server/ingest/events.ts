import { createHash } from 'node:crypto'
import { OrbitEventSchema, type Country, type NewsHeadline, type OrbitEvent } from '@shared'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { store } from '../data/store'
import { env } from '../env'
import { withGoogleModels } from '../ai/providers/googleModels'
import { readCache, writeCache } from '../sources/cache'
import { readLiveWorld } from '../sources/liveWorld'
import { GDELT_SOURCE_ID } from '../sources/gdelt'
import { GOOGLE_NEWS_SOURCE_ID } from '../sources/googleNews'
import { getNewsFeed } from '../sources'
import {
  classifyHeadlines,
  mentionsCountry,
  numbersGrounded,
  outletCount,
  significantWords,
  topStoryCandidate,
  type Candidate,
} from './classify'

/**
 * Automatic event detection: ORBIT reads the live headlines it already fetches, proposes new events
 * itself, and marks them `origin: 'auto'` so the UI can show them as detected but unverified.
 *
 * Guardrails, because this is the part that could invent things:
 * - only live headlines (Google News, GDELT) from the last few days are considered;
 * - a headline must match a known kind of event, or it is skipped, never guessed at;
 * - the summary is written from the headline titles only, and any summary containing a figure that is
 *   not in those headlines is thrown away in favour of a plain quote of the headlines;
 * - anything close to a curated event is dropped, so the fact-checked version always wins;
 * - every candidate is validated against the shared OrbitEvent schema before it is stored.
 */

const CACHE_KEY = 'auto-events'
/** How long a scan's results are reused before the next scan (live mode only). */
export const SCAN_FRESH_MS = 20 * 60_000
// GDELT's feed for a quiet country can be a week old, so the window is generous; the event still
// carries the headline's own date, and the list is sorted by it.
const HEADLINE_MAX_AGE_MS = 14 * 24 * 60 * 60_000
const MAX_PER_COUNTRY = 3
/** Conflict, security and outbreaks (severity 3+) count from a single report. */
const MIN_SEVERITY = 3
/** Economy and diplomacy (severity 2) count once this many outlets report the story. */
const MIN_OUTLETS_ROUTINE = 2
/** Room for about three events per country across the 52 countries. */
const MAX_TOTAL = 150
/** Gemini only polishes summaries this severe (the free quota can't cover ~150 a pass). */
const AI_SUMMARY_MIN_SEVERITY = 3
const AI_TIMEOUT_MS = 12_000

type AutoEventCache = { scannedAt: number; events: OrbitEvent[] }

let scanning: Promise<OrbitEvent[]> | undefined

const LIVE_SOURCES = new Set([GOOGLE_NEWS_SOURCE_ID, GDELT_SOURCE_ID])
const isLive = (n: NewsHeadline) => LIVE_SOURCES.has(n.sourceId)
const isRecent = (n: NewsHeadline) => Date.now() - Date.parse(n.publishedAt) < HEADLINE_MAX_AGE_MS

/** Two titles describe the same story when they share three or more significant words. */
function sameStory(a: string, b: string) {
  const words = new Set(significantWords(b))
  return significantWords(a).filter((w) => words.has(w)).length >= 3
}

/** A plain, checkable summary: what the headlines say, and who published them. */
function quoteHeadlines(candidate: Candidate): string {
  const [first, ...rest] = candidate.headlines
  const publisher = first.publisher ? ` (${first.publisher})` : ''
  const more = rest.length
    ? ` ${rest.length} more headline${rest.length > 1 ? 's' : ''} report the same story.`
    : ''
  return `Reported by live news: "${first.title}"${publisher}.${more} ORBIT detected this automatically and has not verified it; its badge says how well other outlets confirm it.`
}

const SummarySchema = z.object({
  summary: z.string().min(1).max(400),
  severity: z.number().int().min(1).max(5),
})

/**
 * Optional polish: Gemini rewrites the headlines into one neutral sentence. It may use nothing but the
 * headline titles, and its output is rejected if it introduces a figure they do not contain.
 */
async function summariseWithAi(
  candidate: Candidate,
  country: Country,
): Promise<{ summary: string; severity: number }> {
  const fallback = { summary: quoteHeadlines(candidate), severity: candidate.severity }
  if (env.AI_PROVIDER !== 'google' || !env.GOOGLE_GENERATIVE_AI_API_KEY) return fallback
  if (candidate.severity < AI_SUMMARY_MIN_SEVERITY) return fallback
  try {
    const { output } = await withGoogleModels((model) =>
      generateText({
        model,
        maxRetries: 1,
        system:
          'You turn news headlines into one neutral sentence for an intelligence dashboard. ' +
          'Use ONLY the headlines given. Never add a fact, a number, a cause or a consequence that is not in them. ' +
          'No speculation, no adjectives of alarm. Also rate severity 1-5 (1 routine, 5 severe and widespread).',
        prompt: `Country: ${country.name}\nHeadlines:\n${candidate.headlines.map((h) => `- ${h.title}`).join('\n')}`,
        output: Output.object({ schema: SummarySchema, name: 'event' }),
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      }),
    )
    if (!numbersGrounded(output.summary, candidate.headlines)) return fallback
    return {
      summary: `${output.summary} ORBIT detected this automatically and has not verified it.`,
      severity: output.severity,
    }
  } catch {
    return fallback
  }
}

/** Gemini summaries already written, per story (first headline URL), so each story costs one call ever. */
const SUMMARY_CACHE_KEY = 'ai-event-summaries'
type SummaryCache = Record<string, { summary: string; severity: number }>

async function summarise(
  candidate: Candidate,
  country: Country,
): Promise<{ summary: string; severity: number }> {
  const key = createHash('sha1').update(candidate.headlines[0].url).digest('hex').slice(0, 16)
  const cache = (await readCache<SummaryCache>(SUMMARY_CACHE_KEY)) ?? {}
  if (cache[key]) return cache[key]
  const result = await summariseWithAi(candidate, country)
  // Only real AI summaries are saved; a fallback quote is retried next time.
  if (result.summary !== quoteHeadlines(candidate))
    await writeCache(SUMMARY_CACHE_KEY, { ...cache, [key]: result })
  return result
}

function buildEvent(
  candidate: Candidate,
  country: Country,
  detail: { summary: string; severity: number },
): OrbitEvent | undefined {
  const hash = createHash('sha1').update(candidate.headlines[0].url).digest('hex').slice(0, 10)
  const newest = candidate.headlines
    .map((h) => h.publishedAt)
    .sort()
    .at(-1)!
  const base = {
    title: candidate.title,
    summary: detail.summary,
    countryIds: [country.id],
    location: country.centroid,
    occurredAt: newest,
    severity: detail.severity,
    // Cite the feeds the headlines actually came from.
    sourceIds: [...new Set(candidate.headlines.map((h) => h.sourceId))],
    tags: [candidate.label, 'auto-detected'],
    origin: 'auto' as const,
    detectedAt: new Date().toISOString(),
    headlineUrls: candidate.headlines.map((h) => h.url),
  }
  const event =
    candidate.kind === 'health'
      ? {
          ...base,
          kind: 'health' as const,
          id: `hs_auto_${hash}`,
          indicator: 'Reported in live news',
        }
      : {
          ...base,
          kind: 'geopolitical' as const,
          id: `evt_auto_${hash}`,
          category: candidate.label,
          actors: [],
        }
  const parsed = OrbitEventSchema.safeParse(event)
  if (!parsed.success) {
    console.warn('[ingest] dropped a candidate that failed validation:', parsed.error.message)
    return undefined
  }
  return parsed.data
}

/** Reads every country's live headlines and returns the events ORBIT detects in them. */
export async function scanForAutoEvents(): Promise<OrbitEvent[]> {
  const curated = store.getEvents()
  const detected: OrbitEvent[] = []

  for (const country of store.getCountries()) {
    const headlines = (await getNewsFeed(country.id)).filter((n) => isLive(n) && isRecent(n))
    if (headlines.length === 0) continue
    const isNew = (c: { title: string }) => !curated.some((e) => sameStory(e.title, c.title))
    let candidates = classifyHeadlines(headlines)
      .filter(
        (c) =>
          (c.severity >= MIN_SEVERITY || outletCount(c) >= MIN_OUTLETS_ROUTINE) &&
          mentionsCountry(c.title, country) &&
          isNew(c),
      )
      .slice(0, MAX_PER_COUNTRY)
    // A quiet country still gets its most-reported story of the day, so its events stay current.
    if (!candidates.length) {
      const top = topStoryCandidate(
        headlines.filter((h) => mentionsCountry(h.title, country)),
        MIN_OUTLETS_ROUTINE,
      )
      if (top && isNew(top)) candidates = [top]
    }
    for (const candidate of candidates) {
      if (detected.some((e) => sameStory(e.title, candidate.title))) continue
      const event = buildEvent(candidate, country, await summarise(candidate, country))
      if (event) detected.push(event)
    }
  }

  const events = detected
    .sort((a, b) => b.severity - a.severity || b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, MAX_TOTAL)
  await writeCache(CACHE_KEY, { scannedAt: Date.now(), events } satisfies AutoEventCache)
  console.log(`[ingest] detected ${events.length} event(s) from live headlines`)
  return events
}

/** One scan at a time: a second caller joins the one already running. */
export function runScan(): Promise<OrbitEvent[]> {
  scanning ??= scanForAutoEvents().finally(() => (scanning = undefined))
  return scanning
}

/**
 * The detected events. Answers from the last scan immediately, and starts a new scan in the background
 * when that is older than SCAN_FRESH_MS, so the UI never waits for GDELT or Gemini.
 */
export async function getAutoEvents(): Promise<OrbitEvent[]> {
  if (env.DATA_MODE !== 'live') return []
  // The live pipeline's last pass: WHO health signals + detected events, each with trust.
  const world = await readLiveWorld()
  if (world) return [...world.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const cached = await readCache<AutoEventCache>(CACHE_KEY)
  if (!cached || Date.now() - cached.scannedAt >= SCAN_FRESH_MS) void runScan()
  return cached?.events ?? []
}

export async function getAutoEvent(id: string): Promise<OrbitEvent | undefined> {
  return (await getAutoEvents()).find((e) => e.id === id)
}
