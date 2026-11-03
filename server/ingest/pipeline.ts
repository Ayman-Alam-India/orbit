import type { ImpactLink, NewsHeadline, OrbitEvent, Trust } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { NEWS_FRESH_MS, getNewsFeed, refreshAllFeeds } from '../sources'
import { writeCache } from '../sources/cache'
import { GDELT_SOURCE_ID } from '../sources/gdelt'
import { GOOGLE_NEWS_SOURCE_ID } from '../sources/googleNews'
import { LIVE_WORLD_KEY, type LiveWorld } from '../sources/liveWorld'
import { getMarkets } from '../sources/markets'
import { fetchWhoSignals, whoState } from '../sources/who'
import { runScan } from './events'
import { aiImportant, ruleImportance, type Importance } from './importance'
import { draftRipples, findEvidence } from './ripples'
import {
  aiBudget,
  headlineTrust as checkHeadline,
  liveTrust,
  officialTrust,
  outletTrust,
  outletsOf,
  storyIndex,
} from './trust'

/** The focus country: its headlines are ranked by Gemini and checked by Gemini + Groq every pass. */
export const FOCUS_COUNTRY = 'IND'
/** Focus-country headlines AI-checked per pass (newest important ones first; answers are cached). */
export const focusBudget = { perPass: 6 }

/**
 * ORBIT's live pipeline: one ordered pass, every 10 minutes in DATA_MODE=live.
 *   1. news     every country's headlines (Google News, GDELT fallback)
 *   2. health   WHO Disease Outbreak News → official health signals, one pin per country
 *   3. events   ORBIT's detector reads the headlines for new events
 *   4. ripples  rules link each event to the countries and markets that depend on it, with news evidence
 *   5. trust    the one verification rule rates every headline, event and ripple; India's headlines
 *               are also ranked important/normal by Gemini and checked by Gemini + Groq
 * The result is saved (server/.cache/live-world.json) and served by the routes; with wifi off the
 * last pass keeps working.
 */

const isLiveHeadline = (h: NewsHeadline) =>
  h.sourceId === GOOGLE_NEWS_SOURCE_ID || h.sourceId === GDELT_SOURCE_ID

export async function allLiveHeadlines() {
  const feeds = await Promise.all(
    [undefined, ...store.getCountries().map((c) => c.id)].map((id) => getNewsFeed(id)),
  )
  return [
    ...new Map(
      feeds
        .flat()
        .filter(isLiveHeadline)
        .map((h) => [h.url, h]),
    ).values(),
  ]
}

/** Runs steps 1–5 once. Never throws: a failing step logs and the pass continues with what it has. */
export async function runPipeline(): Promise<LiveWorld> {
  const started = Date.now()
  const step = async <T>(name: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      console.warn(`[ingest] pipeline step "${name}" failed:`, err)
      return fallback
    }
  }

  // 1. News
  const feeds = await step('news', refreshAllFeeds, { ok: 0, total: 0 })
  const headlines = await step('headlines', allLiveHeadlines, [])
  const index = storyIndex(headlines)

  // 2. Health (WHO is official: verified by definition)
  const who = await step('who', fetchWhoSignals, [])
  const whoName = store.getSources().find((s) => s.id === who[0]?.sourceIds[0])?.name ?? 'WHO'

  // 3. Events detected in headlines
  const detected = await step('events', runScan, [])

  // 5a. Trust for events (the AI is only asked once 3+ outlets report a story)
  const budget = { left: aiBudget.perPass }
  const sources = store.getSources()
  const events: OrbitEvent[] = [
    ...who.map((e) => ({ ...e, trust: officialTrust(whoName) })),
    ...(await Promise.all(
      detected.map(async (e) => ({
        ...e,
        trust: await liveTrust(
          `${e.title}. ${e.summary}`,
          index.sameStory(e.title, e.headlineUrls),
          sources,
          budget,
        ),
      })),
    )),
  ]

  // 4. Ripples for curated and live events, then 5b. their trust
  const marketIds = new Set(store.getMarkets().map((m) => m.id))
  const drafts = draftRipples(
    [...store.getEvents(), ...events],
    store.getImpacts(),
    store.getCountries(),
    marketIds,
  )
  const withEvidence = await step('ripples', () => findEvidence(drafts), [])
  const ripples: ImpactLink[] = []
  for (const { link, evidence } of withEvidence) {
    ripples.push({
      ...link,
      trust: await liveTrust(`${link.effect}: ${link.mechanism}`, evidence, sources, budget),
    })
  }

  // 5c. Headlines: importance and trust. Everywhere the outlet rule; for the focus country
  // (India) Gemini also ranks importance and Gemini + Groq check the important ones.
  const headlineTrust: Record<string, Trust> = {}
  const headlineImportance: Record<string, Importance> = {}
  for (const h of headlines) {
    const outlets = outletsOf(index.sameStory(h.title))
    headlineTrust[h.url] = outletTrust(outlets)
    headlineImportance[h.url] = ruleImportance(h, outlets.length)
  }
  const focus = headlines
    .filter((h) => h.countryIds.includes(FOCUS_COUNTRY))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const focusName = store.getCountry(FOCUS_COUNTRY)?.name ?? FOCUS_COUNTRY
  for (const url of await step(
    'importance',
    () => aiImportant(focus, focusName),
    new Set<string>(),
  ))
    headlineImportance[url] = 'important'
  const focusBudgetLeft = { left: focusBudget.perPass }
  for (const h of focus.filter((x) => headlineImportance[x.url] === 'important')) {
    if (focusBudgetLeft.left <= 0) break
    headlineTrust[h.url] = await step(
      'focus check',
      () => checkHeadline(h, index.sameStory(h.title), sources, focusBudgetLeft),
      headlineTrust[h.url],
    )
  }

  // Source health for GET /api/status.
  const fuel = (await step('fuel', () => getMarkets(FOCUS_COUNTRY), [])).filter(
    (m) => m.kind === 'fuel',
  )
  const liveFuel = fuel.filter((m) => m.live).length
  const sourceHealth = [
    { name: 'Google News', ok: feeds.ok > 0, detail: `${feeds.ok}/${feeds.total} feeds updated` },
    { name: 'WHO outbreak news', ok: whoState.ok, detail: `${who.length} health signals` },
    {
      name: 'Indian fuel prices',
      ok: liveFuel > 0,
      detail: `${liveFuel}/${fuel.length} live prices`,
    },
    {
      name: 'Ripple evidence search',
      ok: withEvidence.some((r) => r.evidence.length),
      detail: `${withEvidence.filter((r) => r.evidence.length).length}/${withEvidence.length} ripples with news evidence`,
    },
  ]

  const world: LiveWorld = {
    ranAt: Date.now(),
    events,
    ripples,
    headlineTrust,
    headlineImportance,
    sources: sourceHealth,
  }
  await writeCache(LIVE_WORLD_KEY, world)

  const all = [...events, ...ripples].map((x) => x.trust?.status)
  const count = (s: string) => all.filter((x) => x === s).length
  const corroboratedHeadlines = Object.values(headlineTrust).filter(
    (t) => t.status === 'corroborated',
  ).length
  console.log(
    `[ingest] pipeline: ${headlines.length} headlines (${corroboratedHeadlines} corroborated), ` +
      `${who.length} WHO signals, ${detected.length} detected events, ${ripples.length} ripples · ` +
      `${count('verified')} verified, ${count('corroborated')} corroborated, ${count('unverified')} unverified · ` +
      `${Math.round((Date.now() - started) / 1000)} s`,
  )
  return world
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Live mode only: run the pipeline now, then every 10 min while the server runs. */
export async function startPipeline(): Promise<void> {
  if (env.DATA_MODE !== 'live' || timer) return
  console.log('[ingest] live pipeline: news → WHO → events → ripples → trust, every 10 min')
  const pass = async () => {
    await runPipeline().catch((err) => console.warn('[ingest] pipeline pass failed:', err))
    timer = setTimeout(() => void pass(), NEWS_FRESH_MS)
    timer.unref?.()
  }
  await pass()
}
