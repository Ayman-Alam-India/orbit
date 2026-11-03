import type { NewsHeadline, Trust, TrustCheckRequest } from '@shared'
import { store } from '../data/store'
import { env } from '../env'
import { AppError, notFound } from '../http'
import { writeCache } from '../sources/cache'
import { searchGoogleNews } from '../sources/googleNews'
import { LIVE_WORLD_KEY, readLiveWorld } from '../sources/liveWorld'
import { significantWords } from './classify'
import { aiVerifiers } from '../ai/verify'
import { allLiveHeadlines } from './pipeline'
import { aiCrossCheck, evidenceTrust, storyIndex } from './trust'

/**
 * "Verify now" on one unverified headline, event or ripple: search the news again for the story,
 * count the independent outlets, ask Gemini and Groq (whatever has a key) whether those reports
 * support it, and save the new rating so every view shows it.
 */

/** A news search for a story: its most telling words, last 3 days. */
const queryFor = (text: string) => `${significantWords(text).slice(0, 7).join(' ')} when:3d`

export async function verifyNow({ kind, id }: TrustCheckRequest): Promise<Trust> {
  if (env.DATA_MODE !== 'live')
    throw new AppError('UPSTREAM', 503, 'Live data is off (mock mode), so nothing can be checked')
  const world = await readLiveWorld()
  if (!world) throw new AppError('UPSTREAM', 503, 'The live pipeline has not finished a pass yet')

  const headlines = await allLiveHeadlines()
  let claim: string
  let searchText: string
  let own: NewsHeadline | undefined
  let known: NewsHeadline[] = []
  if (kind === 'headline') {
    own = headlines.find((h) => h.id === id)
    if (!own) throw notFound(`Headline "${id}"`)
    claim = own.title
    searchText = own.title
  } else if (kind === 'event') {
    const event = world.events.find((e) => e.id === id)
    if (!event) throw notFound(`Event "${id}"`)
    claim = `${event.title}. ${event.summary}`
    searchText = event.title
    known = headlines.filter((h) => event.headlineUrls?.includes(h.url))
  } else {
    const link = world.ripples.find((l) => l.id === id)
    if (!link) throw notFound(`Ripple "${id}"`)
    const target =
      link.target.kind === 'country'
        ? store.getCountry(link.target.id)?.name
        : store.getMarkets().find((m) => m.id === link.target.id)?.name
    claim = `${link.effect}: ${link.mechanism}`
    searchText = `${link.effect} ${target ?? ''}`
    known = headlines.filter((h) => link.evidenceUrls?.includes(h.url))
  }

  // Fresh coverage: the story's words searched again, matched to the same story.
  let fresh: NewsHeadline[] = []
  try {
    fresh = await searchGoogleNews(queryFor(searchText))
  } catch (err) {
    console.warn('[ingest] verify-now search failed, using saved headlines:', err)
  }
  const index = storyIndex([...headlines, ...fresh])
  const story = [...known, ...index.sameStory(searchText)]
  // Ripples describe an effect, not a headline: articles found by the search count as reports of it.
  const reports = kind === 'ripple' ? [...story, ...fresh.slice(0, 6)] : story
  const evidence = [...new Map(reports.map((h) => [h.url, h])).values()].filter(
    (h) => !own || (h.url !== own.url && h.publisher !== own.publisher),
  )
  // Asked on request: the AI checks even when fewer than 3 outlets report it (the rating still
  // needs 3 for "corroborated"; the reason says what the AI concluded).
  const ai = await aiCrossCheck(claim, evidence, store.getSources(), { left: 1 })
  const rated = evidenceTrust(own ? [own, ...evidence] : evidence, ai)
  const trust = aiVerifiers().length
    ? rated
    : {
        ...rated,
        reason: `${rated.reason} AI checkers are off: add the Gemini and Groq keys to .env.`,
      }

  // Save it, so the badge is the same everywhere (and survives until the next pass rates it again).
  if (own) world.headlineTrust[own.url] = trust
  else if (kind === 'event')
    world.events = world.events.map((e) => (e.id === id ? { ...e, trust } : e))
  else world.ripples = world.ripples.map((l) => (l.id === id ? { ...l, trust } : l))
  await writeCache(LIVE_WORLD_KEY, world)
  console.log(`[ingest] verify now: ${kind} ${id} → ${trust.status} (${trust.reason})`)
  return trust
}
