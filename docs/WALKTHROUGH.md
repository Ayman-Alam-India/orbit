# ORBIT: explain the code, answer the hard questions

Written after Review 2, where we were asked three fair questions and answered them badly. This document
is the fix: the honest answers, a map of the code, and a short script for each of us. Read part 1 and
your own script in part 5. Fifteen minutes is enough.

---

## 1. The questions we were asked, answered properly

### "If there is a new headline tomorrow, does ORBIT add it by itself?"

**Say this:** "Yes. Headlines were always automatic, and since this review events are too: ORBIT reads the
live feed, proposes events itself, and marks them unverified until a human checks them."

| Layer                       | Automatic?                                                                             | Why                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **News headlines**          | **Yes.** Live from GDELT, no code change.                                              | Each country's feed is fetched in the background and reused for 30 minutes, then refreshed. Nobody edits a file.            |
| **Markets**                 | **Yes.** Yahoo Finance every 15 minutes.                                               | Same pattern: fetch, validate, cache, fall back to the stored snapshot.                                                     |
| **Weather**                 | **Yes.** Open-Meteo, cached 30 minutes.                                                | Same pattern.                                                                                                               |
| **Events (the globe pins)** | **Yes.** Detected from those headlines every 20 minutes, or on demand with "Scan now". | `server/ingest/`: keyword classifier, optional Gemini sentence, contract validation. Shown as auto-detected and unverified. |
| **Ripple links**            | Curated by us.                                                                         | A causal claim ("this raises India's import bill") is the thing we least want a model to invent.                            |

Where it happens in the code: `server/sources/index.ts` (`refreshNewsFeed`, 30-minute freshness),
`server/sources/gdelt.ts` (the free GDELT DOC 2.0 API, throttled to one request per 10 seconds with a
back-off), `server/sources/markets.ts`, `server/sources/weather.ts`. All of them write to
`server/.cache/` so the demo survives a dead network.

**Then show it:** on the global view, the **Detected by ORBIT** panel, and press **Scan now** while you
talk. Open one and point at the "Auto-detected · unverified" badge.

**The sentence that wins the question:** "Detection is automatic, verification is not, and we keep the two
visibly apart." The guardrails — why it cannot invent a figure, and why a curated event always wins — are
in [AUTO_EVENTS.md](AUTO_EVENTS.md).

### "What is your dataset?"

**Say this:** "Two layers. A curated, source-checked core, and live feeds on top of it."

**Layer 1, curated** (`server/data/seed/*.json`, validated against the shared schemas every time the
server boots — a bad reference or a wrong ID format stops the server):

| File             | Rows | What it holds                                                                                           |
| ---------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `countries.json` | 15   | Profile, capital, population, centroid, risk level, summary                                             |
| `events.json`    | 14   | 7 health + 7 geopolitical, each with severity, location, source IDs                                     |
| `sources.json`   | 17   | WHO, UKHSA, U.S. EIA, the Fed, UN, Times of Israel, Kyiv Post, ThePrint… each with a reliability rating |
| `news.json`      | 7    | Curated headlines tied to events                                                                        |
| `timeline.json`  | 11   | Country history entries                                                                                 |
| `impacts.json`   | 10   | Ripple links: event → country or market, with channel and basis                                         |
| `markets.json`   | 10   | Brent, USD/INR, NIFTY 50, Sensex, Reliance, TCS, HDFC, Infosys, Delhi petrol and diesel                 |
| `scenarios.json` | 2    | Hormuz and Bab el-Mandeb, with EIA volumes                                                              |

**Layer 2, live**: GDELT (news), Yahoo Finance (markets), Open-Meteo (weather). All free, all keyless,
all cached to disk with the curated data as the fallback.

**If asked "so it's hard-coded?"**: "The core is curated the way a newsroom curates: every row names its
source and we can show you the article. The live layers are not curated at all. And the structure is a
schema, not a hard-coded page: adding a country is one JSON object, not a code change."

**If asked about size**: "Small on purpose. 24 hours, and every row is fact-checked. The architecture takes
thousands of rows without a change: the store, the API and the globe don't care how many rows there are."

### "Explain your code and your tech stack"

Parts 2–6 below. The short version, memorise it:

> "Three folders. `shared/` holds Zod schemas that define every object and are the single source of truth
> for types and validation. `server/` is an Express API that loads and validates the curated data, adds live
> sources and the AI, and never lets an API key reach the browser. `src/` is a React app: the 3D globe plus
> feature folders, TanStack Query for server data, Zustand for small UI state, the URL for what is selected.
> 121 tests and a build gate every merge."

---

## 2. The map of the repo

139 TypeScript files, about 7,700 lines.

```
shared/          The contract. One Zod schema per entity + API_ROUTES. Imported by BOTH sides as '@shared'.
  schemas/       country, event, news, source, timeline, insight, ask, verification, impact, market,
                 weather, simulation, common
  api.ts         Every URL the frontend may call, as functions: API_ROUTES.country('IND')

server/          The API (Express 5 on Node, run by tsx, no build step)
  data/
    seed/        The curated dataset (the 8 JSON files above)
    store.ts     Loads seed files at startup, validates them with the schemas, cross-checks every
                 reference (an event pointing at a missing source stops the server), exposes getters
    fixtures/    A small fake dataset used only by tests
  routes/        One file per area: countries, events, news, ai, world (impacts, markets, weather,
                 scenarios, simulate), meta (health)
  ingest/        Automatic event detection from live headlines: classify.ts + events.ts
  sources/       Live data: gdelt.ts, markets.ts, weather.ts, cache.ts (disk cache in server/.cache)
  ai/            index.ts (context + insight + ask), prompt.ts (system prompt and context JSON),
                 providers/ (google, mock), verify/ (claims, llm, rules), tts.ts (narrator voice)
  sim/           simulate.ts: the what-if engine. Pure arithmetic, no AI, unit-tested
  http.ts        The envelope: ok(), AppError, notFound(), parseInput() (Zod), error handler
  app.ts         Wires the routers together      index.ts  Starts it, validates the seed first

src/             The React app
  globe/         OrbitGlobe.tsx (three.js globe), rippleArcs.ts, globeStyle.ts
  layout/        OrbitLayout (shell), TopBar, SearchBox, HeadlineTicker, TourOverlay, GlobalOverview
  features/      One folder per feature, each with its hook + components:
                 country, event, timeline, news, markets, weather, ripple, simulate, insight, ask,
                 tour, health
  api/client.ts  The ONLY place that calls fetch. Unwraps { data }, throws on { error }
  state/         uiStore.ts (Zustand): hover, Ask drawer, simulation, tour. Nothing that belongs in the URL
  routes.ts      ROUTE_PATTERNS and paths(): the URL is the app's state
  ui/            Button, Panel, Tag, Loader, ErrorState, ErrorBoundary… the shared primitives
  styles/        tokens.css (colours, spacing, radii, fonts) + cssVar() so WebGL can read the same tokens

docs/            PLAYBOOK, API, REVIEW, DESIGN_SYSTEM, INTEGRATION, ALLOCATOR + the PDFs
tasks.json       Who owns what, with acceptance criteria        AGENTS.md  Rules for contributors
```

**The rule that keeps it together:** a type is declared once, in `shared/`, as a Zod schema. The server
validates data with it, the frontend gets the TypeScript type from it, and the tests check both. If the
two sides disagree, the build fails on our laptops, not in front of a reviewer.

---

## 3. Follow one click through the whole system

Someone clicks India on the globe. Be able to narrate this:

1. **`src/globe/OrbitGlobe.tsx`** — the polygon click handler calls `navigate(paths.country('IND'))`.
2. **The URL changes to `/country/IND`.** The URL is our state: refresh, share or press back and the app
   is in the same place. (`src/routes.ts`)
3. **`src/layout/OrbitLayout.tsx`** sees it is no longer the global route, so the globe animates down into
   the mini globe and the country view fills the centre column.
4. **`src/features/country/useCountry.ts`** asks TanStack Query for `['country','IND']`. If that key is
   already cached, it renders instantly and refetches quietly.
5. **`src/api/client.ts`** does the only `fetch` in the app: `GET /api/countries/IND`. Vite's dev server
   proxies `/api` to the API server on port 8787.
6. **`server/routes/countries.ts`** validates the ID with `parseInput(CountryIdSchema, …)` — a bad ID is a
   400 with a clear message, never a crash — then asks the store.
7. **`server/data/store.ts`** returns the country from the data it validated at startup. Missing → `notFound()` → 404.
8. **`server/http.ts`** wraps it: `{ "data": { … } }`. Every error is `{ "error": { code, message } }`.
9. **Back in the browser**, the view renders, and its sibling panels fire their own queries: events,
   timeline, news (live GDELT), markets (live Yahoo), weather (live Open-Meteo), ripple effects, and the
   AI briefing.
10. **Each panel handles its own failure**: `QueryState` shows a loader, then an error card with a retry,
    and an `ErrorBoundary` keeps one broken panel from taking down the page.

---

## 4. How an AI answer is built (the part reviewers probe)

1. **Context, not the internet** — `server/ai/index.ts` `buildContext()` collects only the relevant rows
   from our own data: the country or event, its sources, related headlines, ripple links, markets, and the
   current simulation if there is one.
2. **Prompt** — `server/ai/prompt.ts`. The system prompt forbids outside knowledge, requires source IDs
   exactly as given, requires saying "ORBIT analysis" for our reasoning and "simulation" for what-ifs.
3. **Structured output** — the model must return an object matching a Zod schema (summary, key points,
   source IDs, confidence). Source IDs that aren't in the context are dropped (`providers/google.ts`).
4. **Verification** — `server/ai/verify/`: the answer is split into claims (`claims.ts`), then checked by
   Gemini (`llm.ts`), Groq (`llm.ts`) and a deterministic checker (`rules.ts`: every number and most key
   terms must appear in our data). Agreement is shown in the UI, disagreement too.
5. **Fallbacks** — model list (Gemini 3.5 Flash → Flash-Lite), then the cached insight, then an offline
   analyser labelled "Offline analysis". Insights are reused for 30 minutes to stay inside free quotas.

**One-sentence version:** "The model never browses. It only summarises rows we already have, it must cite
their IDs, and two other checkers verify each claim against the same rows."

---

## 5. Who explains what (60 seconds each)

Learn your own. Say the file names — it proves you wrote it.

**Ayman — the flow and the frontend.** "The URL is our state: `/country/IND/event/...`. `OrbitLayout`
switches between the full globe and the mini globe, feature folders under `src/features` each own a hook
and a panel, TanStack Query caches server data so going back is instant, and Zustand holds only throwaway
UI state like hover and whether the Ask drawer is open."

**Arham — the globe and the design system.** "`OrbitGlobe.tsx` is react-globe.gl over three.js: NASA
textures, country polygons from Natural Earth, pins coloured by severity, rings on severe events and
animated arcs for ripple effects. Colours are CSS custom properties in `tokens.css`, and `cssVar()` hands
the same tokens to WebGL, so the 3D scene and the UI can never drift apart."

**Affan — the AI and trust.** Use part 4. Finish with: "Gemini writes, Groq and a rule checker audit. The
rule checker uses no AI at all, so even with no internet we can still prove the numbers are in our data."

**Shrey — the data.** Use part 1's dataset answer. Finish with: "Each row names its source, and
`store.ts` refuses to start the server if any reference is broken, so a demo can't run on inconsistent data."

**Hardik — engineering process and reliability.** "Every change is a branch and a pull request. `npm run
check` runs ESLint, 112 tests and a production TypeScript build; it must pass before a merge. Tests run
against the real API with fixture data, never real keys. For reliability: live sources fall back to disk
cache, then to curated data; the AI falls back through models, cache, then an offline analyser; error
boundaries isolate failures. We rehearsed with the wifi off."

---

## 6. Rapid-fire questions about the code

**Why Express and not Next.js?** No user accounts, read-only data, and we needed a plain API the frontend
and the tests could both hit. Express plus `tsx` gave us TypeScript with no build step.

**Why no database?** The curated dataset is 8 JSON files validated at startup, and everything live is a
cache with a fallback. A database would add ops work and no benefit in 24 hours. The store is one module,
so swapping JSON for Postgres touches `server/data/store.ts` only.

**Why Zod?** One definition gives us runtime validation and the TypeScript type. It validates seed data,
request input and AI output, so bad data fails at the boundary with a readable message.

**How is state managed?** Three tiers, on purpose: the URL holds what is selected, TanStack Query holds
server data (caching, retries, background refresh), Zustand holds small UI state. Nothing is duplicated.

**How do you keep API keys safe?** They live in `.env` on the server only, read through `server/env.ts`.
The browser calls our own `/api`, never Google or Groq. There are no `VITE_` secrets. `.env` is gitignored.

**What do the tests actually cover?** 121 tests, 26 files: schema contracts, seed integrity, every API
route, AI grounding and its fallbacks, claim verification, the simulator's arithmetic, the tour's stop
order, automatic event detection, and the React views with a real API server on a random port using fixtures.

**How does the simulator work?** `server/sim/simulate.ts`, pure functions, no AI: new Brent = live × (1 +
the shock you chose); stranded oil = EIA's 20 million b/d minus 2.6 of pipeline bypass; per-litre =
ΔBrent × USD/INR ÷ 158.987 litres a barrel. Each result carries the formula that produced it.

**What happens with no internet?** Curated data plus the disk cache: news, markets, weather, AI answers and
the narrator's voice all keep working, and anything genuinely missing says so instead of showing a blank.

**How long does a cold start take?** `npm install`, then `npm run dev` — two processes, web on 5173 and API
on 8787. The server validates the whole dataset before it accepts a request.

**Can we see it fail?** Yes: stop the API server and the UI shows "Cannot reach the ORBIT server", not a
white screen. Pass a bad country ID and you get a 400 with the reason.

---

## 7. Have these ready on the laptop

- The app running at `localhost:5173`, and `localhost:8787/api/health` in a second tab (it prints the data
  mode and which AI provider is live — a good way to answer "is this really live?").
- `server/data/seed/events.json` open in the editor, to show a row and its `sourceIds`.
- `shared/schemas/event.ts` open, to show the contract those rows are validated against.
- A terminal ready to run `npm run check`, so a reviewer can watch 121 tests pass.
- `docs/API.md` for the endpoint list.
