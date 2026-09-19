# ORBIT API and data contract

Owner: Hardik. The code is the truth: schemas live in `shared/schemas/`, paths in `shared/api.ts`,
and routes in `server/routes/`. This document explains them in plain words. If you find a difference, the code wins,
so tell Hardik and this file gets fixed.

## How it fits together

```
Browser (React)                     API server (Express, port 8787)            Data
─────────────────                   ─────────────────────────────              ─────────────────────────
src/features/*/useX.ts  ──/api/──►  server/routes/*.ts  ──►  server/data/store.ts ──► server/data/seed/*.json
   (TanStack Query)     Vite proxy   (parseInput + ok())     server/sources/       ──► live APIs + server/.cache/
src/api/client.ts                                             server/ai/            ──► AI provider (or mock)
        ▲
        └──────────── shared/ (Zod schemas + API_ROUTES) used by BOTH sides ─────────────┘
```

- In development, the browser calls `http://localhost:5173/api/...` and Vite forwards it to `http://localhost:8787`.
- The browser never calls external APIs or AI directly. Keys stay on the server.

## Response format (every route)

Success, HTTP 200:

```json
{ "data": <the thing you asked for> }
```

Failure, HTTP 4xx/5xx:

```json
{ "error": { "code": "NOT_FOUND", "message": "Country \"XXX\" not found" } }
```

| `code`       | HTTP | Meaning                                                                      |
| ------------ | ---- | ---------------------------------------------------------------------------- |
| `VALIDATION` | 400  | Bad input: wrong ID format, invalid body, invalid query                      |
| `NOT_FOUND`  | 404  | The ID is valid but does not exist, or the route does not exist              |
| `UPSTREAM`   | 502  | A live source failed and there was no fallback (should be rare)              |
| `INTERNAL`   | 500  | A bug on the server (check the server terminal for `[api] unexpected error`) |

In the frontend, `apiGet`/`apiPost` (`src/api/client.ts`) unwrap `data` for you and throw an `ApiClientError`
(`code`, `status`, `message`) on failure. If the server is not running you get `code: "NETWORK"`.

## Routes

Always build paths with `API_ROUTES` from `@shared`. The column "Builder" shows how.

| Method + path                               | Builder                          | Returns (`data`)                                                                                 | Errors                            |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| `GET /api/health`                           | `API_ROUTES.health`              | `HealthStatus` `{ status: "ok", dataMode, aiProvider }`                                          | none                              |
| `GET /api/countries`                        | `API_ROUTES.countries`           | `Country[]`                                                                                      | none                              |
| `GET /api/countries/:id`                    | `API_ROUTES.country(id)`         | `Country`                                                                                        | 400 bad ID, 404                   |
| `GET /api/countries/:id/events`             | `API_ROUTES.countryEvents(id)`   | `OrbitEvent[]` newest first, every event whose `countryIds` includes `id`                        | 400, 404                          |
| `GET /api/countries/:id/timeline`           | `API_ROUTES.countryTimeline(id)` | `TimelineEvent[]` oldest first                                                                   | 400, 404                          |
| `GET /api/events?kind=`                     | `API_ROUTES.events(kind?)`       | `OrbitEvent[]` newest first. `kind` optional: `geopolitical` or `health`                         | 400 bad kind                      |
| `GET /api/events/:id`                       | `API_ROUTES.event(id)`           | `OrbitEvent`                                                                                     | 400 bad ID, 404                   |
| `GET /api/news?countryId=`                  | `API_ROUTES.news(countryId?)`    | `NewsHeadline[]` newest first. Without `countryId`: all                                          | 400 bad ID                        |
| `GET /api/sources`                          | `API_ROUTES.sources`             | `Source[]`                                                                                       | none                              |
| `GET /api/insights/:subjectType/:subjectId` | `API_ROUTES.insight(type, id)`   | `AIInsight`. `subjectType` = `global` (id `world`), `country` (country ID) or `event` (event ID) | 400 bad type, 404 unknown subject |
| `POST /api/ask`                             | `API_ROUTES.ask`                 | `AskAnswer`                                                                                      | 400 invalid body                  |

`POST /api/ask` body (`AskRequest`):

```json
{
  "question": "Why is dengue rising?",
  "context": { "countryId": "IND", "eventId": "hs_ind_dengue_surge" }
}
```

`question` is 1–500 characters. `context` and both of its fields are optional. With `eventId`, ORBIT answers about that
event. With only `countryId`, it answers about that country. With neither, it answers about the world.

## Shared rules for all data

| Rule                                                    | Example                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Country ID = ISO 3166-1 alpha-3, uppercase              | `IND`, `USA`, `BRA` (matches `properties.id` in `public/data/countries.geojson`; Kosovo is `KOS`) |
| Other IDs = prefix + lowercase slug (`a-z`, `0-9`, `_`) | `evt_usa_tariff_review`, `hs_ind_dengue_surge`, `news_...`, `src_...`, `tl_...`, `ins_...`        |
| Dates = ISO 8601 UTC with `Z`                           | `2026-09-19T10:00:00Z`                                                                            |
| Coordinates = `{ lat, lng }`                            | `{ "lat": 28.61, "lng": 77.21 }`                                                                  |
| Severity = integer 1–5                                  | 1 Low, 2 Guarded, 3 Elevated, 4 High, 5 Critical                                                  |
| Field names = camelCase. Enum values = lowercase        | `occurredAt`, `"geopolitical"`                                                                    |

## Entities (data dictionary)

### Country (`shared/schemas/country.ts`)

| Field        | Type             | Notes                           |
| ------------ | ---------------- | ------------------------------- |
| `id`         | CountryId        | `IND`                           |
| `name`       | string           | Display name                    |
| `region`     | string           | e.g. `South Asia`               |
| `capital`    | string           |                                 |
| `centroid`   | `{lat,lng}`      | Where the globe camera flies to |
| `population` | positive integer |                                 |
| `summary`    | string           | One or two sentences            |
| `riskLevel`  | 1–5              | Overall current risk            |

### OrbitEvent (`shared/schemas/event.ts`)

Either a **GeopoliticalEvent** (`kind: "geopolitical"`, ID `evt_...`) or a **HealthSignal** (`kind: "health"`, ID `hs_...`).
Check `kind` before using kind-specific fields.

| Field                            | Type                              | Notes                                                 |
| -------------------------------- | --------------------------------- | ----------------------------------------------------- |
| `kind`                           | `geopolitical` \| `health`        | Decides which extra fields exist                      |
| `id`                             | `evt_...` or `hs_...`             | Prefix must match `kind`                              |
| `title`, `summary`               | string                            |                                                       |
| `countryIds`                     | CountryId[] (≥ 1)                 | The first one is the primary country (used for links) |
| `location`                       | `{lat,lng}`                       | Marker position                                       |
| `occurredAt`                     | ISO date-time                     |                                                       |
| `severity`                       | 1–5                               |                                                       |
| `sourceIds`                      | SourceId[]                        | Must exist in `sources.json`                          |
| `tags`                           | string[]                          | Free-form                                             |
| geopolitical only: `category`    | string                            | Free text until the category list is agreed           |
| geopolitical only: `actors`      | string[]                          | Governments, organisations, people                    |
| health only: `indicator`         | string                            | e.g. `Dengue cases`                                   |
| health only: `metric` (optional) | `{ value: number, unit: string }` | e.g. `{ 18400, "cases this month" }`                  |

### NewsHeadline (`shared/schemas/news.ts`)

`id` (`news_...`), `title`, `url`, `sourceId`, `publishedAt`, `countryIds` (may be empty), `eventId` (optional, links to an OrbitEvent),
`publisher` (optional: the outlet's domain, e.g. `reuters.com`, set for live GDELT headlines whose `sourceId` is `src_gdelt`).

### Source (`shared/schemas/source.ts`)

`id` (`src_...`), `name`, `url`, `type` (`news` \| `government` \| `international_org` \| `research` \| `dataset`), `reliability` (`high` \| `medium` \| `low`).

### TimelineEvent (`shared/schemas/timeline.ts`)

`id` (`tl_...`), `countryId`, `date`, `datePrecision` (`day` \| `month` \| `year`), `title`, `description`, `eventId` (optional).
A year-only fact is stored as 1 January of that year with `datePrecision: "year"`.

### AIInsight (`shared/schemas/insight.ts`)

`id` (`ins_...`), `subjectType` (`global` \| `country` \| `event`), `subjectId` (`world`, a country ID or an event ID), `summary`,
`keyPoints` (≥ 1), `sourceIds`, `confidence` (`low` \| `medium` \| `high`), `provider` (`mock`, `google`, …), `generatedAt`.
It is explainable because it always says which sources it used, how sure it is, and which AI produced it.

### AskRequest / AskAnswer (`shared/schemas/ask.ts`)

Request: `question`, optional `context { countryId?, eventId? }`. Answer: `answer`, `sourceIds`, `provider`, `generatedAt`.

## Relationships

```
Country (IND) ◄── countryIds ── OrbitEvent (evt_/hs_) ── sourceIds ──► Source (src_)
     ▲                              ▲       ▲
     │ countryId                    │       └── eventId ── NewsHeadline (news_) ── sourceId ──► Source
     └── TimelineEvent (tl_) ─ eventId (optional)
AIInsight (ins_) ── subjectId ──► world | Country | OrbitEvent,  sourceIds ──► Source
```

The server checks every one of these links when it starts, and `npm test` checks them too (`server/data/seed.test.ts`).
A broken link stops the server with a message such as `news.json news_x: unknown source "src_missing"`.

## Data files (`server/data/seed/` and `server/data/fixtures/`)

One JSON file per entity, each a plain **array** of objects matching the schema above:

| File             | Contains                                            | Owner |
| ---------------- | --------------------------------------------------- | ----- |
| `countries.json` | `Country[]`                                         | Shrey |
| `events.json`    | `OrbitEvent[]` (both kinds mixed, each with `kind`) | Shrey |
| `news.json`      | `NewsHeadline[]`                                    | Shrey |
| `sources.json`   | `Source[]`                                          | Shrey |
| `timeline.json`  | `TimelineEvent[]`                                   | Shrey |

**Curated seed (what the app shows):** 15 countries, 14 real events (7 geopolitical, 7 health signals), 7 headlines and
11 timeline entries, current as of 19 September 2026. Sourcing rules:

- Every fact comes from a page that was actually opened. Each `sources.json` entry points to that exact page
  (WHO Disease Outbreak News, the UKHSA NaTHNaC outbreak list, the Federal Reserve, the UN, and named news articles).
- Populations (2024) and capitals come from the World Bank (`SP.POP.TOTL` and its country API), and `centroid` is the capital's
  location. Kosovo uses the map's `KOS` code (the World Bank uses `XKX`).
- `riskLevel` and event `severity` are **ORBIT's editorial ratings** based on the tracked events, not an official index.
- Headlines use the article's real title and URL. Dates are publication dates (time set to 00:00 UTC).

**Test fixtures (`server/data/fixtures/`):** a small, stable, clearly fake data set (India, US, Brazil with `example.org`
sources). Tests always run against it (`ORBIT_SEED_DIR` in `vitest.config.ts`), so curating the real seed never breaks a test.

To check your edits, run `npm test`. The seed test validates both data sets, checks that every country exists on the globe
map, and rejects placeholder (`example.org`) sources in the curated seed. It prints the exact file, item and field that is wrong.

## Data modes and future live data

| Setting       | `mock` (default)                      | `live`                                               |
| ------------- | ------------------------------------- | ---------------------------------------------------- |
| `DATA_MODE`   | Seed data only, fully offline         | Seed data + live sources (`server/sources/`)         |
| `AI_PROVIDER` | Offline analysis built from seed data | `google` (Gemini). Falls back to mock on any failure |

Rules for every live source (server-side only):

1. Fetch → validate with the shared schema (drop invalid items) → save with `writeCache(key, data)`.
2. Merge with seed data: seed is always the base, live adds to it.
3. On any failure: log `[sources] ...` and return `readCache(key)`, then seed. Never throw to the route.
4. Live items must follow the same ID rules (e.g. `news_<source>_<slug>`) and reference existing sources.
5. A new external API key = a new empty line in `.env.example` + a field in `server/env.ts`.

**Live news (implemented): GDELT** (`server/sources/gdelt.ts`), free and keyless.

- Feeds: one per country (query = the country's name) plus a global feed (the countries with severity 4–5 events).
  English-language articles from the last 7 days, max 10 per feed, `id` = `news_gdelt_<hash of URL>`.
- `GET /api/news` answers **immediately** with seed + cached live headlines. A stale or missing cache (over 30 min old)
  starts a background refresh, so GDELT's slowness never blocks the UI. Live headlines therefore appear on the next load.
- In `DATA_MODE=live` the server pre-fetches every feed on startup (`[sources] warming live news…`), one request
  every 10 s with a 20 s back-off on HTTP 429, because GDELT rate-limits hard. Start it well before the demo so the cache is full.
- Cached feeds live in `server/.cache/news-<COUNTRY|global>.json`. With wifi off, cached and seed headlines keep working.

## Changing this contract

Adding a field, route or entity is a contract change. Follow `docs/INTEGRATION.md#contract-changes`.
Hardik updates `shared/`, this document and the tests in one PR, which merges before the feature that needs it.
