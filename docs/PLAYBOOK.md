# ORBIT team playbook

The foundation knowledge for the five ORBIT developers, in one place. Detailed rules live in the documents linked from
each section. This playbook summarises them and never overrides them.

| Document                | What it is the authority on                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `AGENTS.md`             | Rules for people and coding agents: stack, folder ownership, contracts, styling, testing, Git |
| `tasks.json`            | Who does what: every task, owner, branch, dependencies, acceptance criteria                   |
| `docs/API.md`           | API routes, request/response shapes, data dictionary, mock data format                        |
| `docs/INTEGRATION.md`   | Branches, commits, PRs, contract changes, merging                                             |
| `docs/DESIGN_SYSTEM.md` | Tokens, primitives, UI states and conventions                                                 |
| `docs/ALLOCATOR.md`     | The personal LLM prompt that tells each person what to do                                     |

---

## 1. Project overview

**ORBIT** is an AI-powered global intelligence platform. It combines geopolitical intelligence, healthcare intelligence,
global news, geography, history/timelines and explainable AI around an interactive 3D globe.

**Flow:** Global → Country → Event → Explanation → Ask ORBIT.

**Look:** deep black, electric cyan, amber/orange. Futuristic, premium, cinematic and clean.

**Constraints:** 24-hour hackathon, five student developers, live demo on one laptop, must survive bad wifi.
Our priorities, in order: reliability, speed, visual quality, easy collaboration, few merge conflicts, maintainability, demo quality.

## 2. Architecture

```
┌────────────────────────── Browser: http://localhost:5173 ──────────────────────────┐
│  React app (src/)                                                                  │
│  ┌──────────────┐   URL = selection (/country/IND/event/hs_...)  (src/routes.ts)   │
│  │ 3D globe     │   Zustand = hover / Ask panel open             (src/state/)      │
│  │ (src/globe)  │   TanStack Query = server data, hooks per feature                │
│  └──────────────┘   Panels (src/features/*) inside the layout (src/layout/)        │
│            src/api/client.ts  ── the only fetch ──►  /api/...                      │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        │ Vite dev proxy
┌───────────────────────── API server: http://localhost:8787 ────────────────────────┐
│  server/routes/*  ──►  server/data/store.ts  ──►  server/data/seed/*.json (always)  │
│                   ──►  server/sources/       ──►  live APIs, cached in server/.cache│
│                   ──►  server/ai/            ──►  AI provider, or mock (fallback)   │
└────────────────────────────────────────────────────────────────────────────────────┘
        shared/ = Zod schemas + API_ROUTES, imported by both sides as `@shared`
```

**The reasons behind each part:**

- **One small server:** it keeps API keys secret, avoids browser CORS blocks, and caches responses for the offline demo.
- **Seed data first:** the demo never depends on wifi. Live data only adds to it.
- **The mock AI** works with no key and is the automatic fallback.
- **No database:** the data is mostly read-only and small.

## 3. Stack (frozen)

Vite 8 · React 19 · TypeScript (strict) · react-globe.gl / three.js · Express 5 (tsx) · Zod 4 · TanStack Query 5 ·
Zustand 5 · React Router 7 · CSS Modules + tokens · Vercel AI SDK (`ai`, `@ai-sdk/google`) · Vitest 3 + Testing Library ·
ESLint 9 + Prettier · **npm** · **Node ≥ 22.12** (team uses 24). Details and forbidden alternatives: `AGENTS.md` section 2.

## 4. Repository map

```
AGENTS.md  CLAUDE.md  .cursor/rules/   Agent rules (AGENTS.md is the source)
README.md                              Start here
tasks.json                             Task manifest (who does what)
.env.example                           Every environment variable, safe defaults
docs/                                  API, integration, design system, playbook, allocator, PDF
shared/                                Contracts: schemas/ (one file per entity) + api.ts (routes, envelope)
server/
  index.ts  app.ts  env.ts  http.ts    Server start, app, env parsing, response/error helpers
  routes/                              countries, events, news, meta (health, sources), ai (insights, ask)
  data/store.ts  data/seed/*.json      Seed loading + validation, curated data
  sources/                             Live data + disk cache
  ai/                                  AI entry point, providers (mock, google)
src/
  App.tsx  routes.ts  main.tsx         Routes (all declared once), URL helpers, bootstrap
  api/client.ts                        The only fetch
  layout/                              App shell, global overview, 404
  globe/                               The 3D globe
  features/<name>/                     country, event, timeline, news, health, insight, ask
  ui/                                  Shared UI primitives
  styles/                              tokens.css, global.css, cssVar.ts
  state/                               Zustand store
  test/                                Test setup and helpers
public/data/countries.geojson          Country shapes (Natural Earth 110m, keyed by alpha-3 id)
scripts/                               Tooling (PDF build, tasks.json test)
mcp/  workshop-data/  .vscode/mcp.json Hackathon organiser tooling: do not touch
```

## 5. Contracts

The rules, summarised (full rules in `AGENTS.md` section 4 and `docs/API.md`):

- Every data type exists **once** as a Zod schema in `shared/schemas/`. The TypeScript type comes from `z.infer`.
- Import from `@shared` only. Never redefine a type. `OrbitEvent`, never `Event`.
- IDs: country = `IND`. Others = `evt_`, `hs_`, `news_`, `src_`, `tl_`, `ins_` + lowercase slug.
- Dates are ISO UTC strings. Coordinates are `{lat, lng}`. Severity is an integer 1–5. Fields are camelCase. Enums are lowercase.
- Responses: `{ data }` or `{ error: { code, message } }`.
- Changing a contract → `docs/INTEGRATION.md#contract-changes`.

## 6. API contract and data dictionary

| Route                                                          | Returns                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/health`                                              | server status, data mode, AI provider                            |
| `GET /api/countries`, `/api/countries/:id`                     | Country list / one Country                                       |
| `GET /api/countries/:id/events`, `/api/countries/:id/timeline` | a country's events / history                                     |
| `GET /api/events?kind=`, `/api/events/:id`                     | all events (optionally by kind) / one event                      |
| `GET /api/news?countryId=`                                     | headlines                                                        |
| `GET /api/sources`                                             | sources                                                          |
| `GET /api/insights/:subjectType/:subjectId`                    | AI explanation for `global/world`, `country/IND` or `event/<id>` |
| `POST /api/ask`                                                | AI answer to `{ question, context? }`                            |

| Entity        | Key fields                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Country       | id, name, region, capital, centroid, population, summary, riskLevel                                                                       |
| OrbitEvent    | kind (geopolitical \| health), id, title, summary, countryIds, location, occurredAt, severity, sourceIds, tags, plus kind-specific fields |
| NewsHeadline  | id, title, url, sourceId, publishedAt, countryIds, eventId?                                                                               |
| Source        | id, name, url, type, reliability                                                                                                          |
| TimelineEvent | id, countryId, date, datePrecision, title, description, eventId?                                                                          |
| AIInsight     | id, subjectType, subjectId, summary, keyPoints, sourceIds, confidence, provider, generatedAt                                              |

Full shapes, errors, relationships and the mock-data format: `docs/API.md`.

## 7. Environment setup

```powershell
# once
git clone https://github.com/Ayman-Alam-India/orbit C:\dev\orbit   # NOT inside OneDrive
cd C:\dev\orbit
node -v          # must be 22.12 or newer
npm install
copy .env.example .env     # optional: every value has a safe default

# every day
npm run dev      # web on http://localhost:5173 + API on :8787
npm run check    # lint + tests + build: must pass before any PR
```

| Variable                       | Default                                  | Meaning                                                       |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| `PORT`                         | `8787`                                   | API server port (Vite proxies `/api` to it)                   |
| `DATA_MODE`                    | `mock`                                   | `mock` = seed only, `live` = seed + live sources              |
| `AI_PROVIDER`                  | `mock`                                   | `mock` or `google`                                            |
| `GOOGLE_GENERATIVE_AI_API_KEY` | empty                                    | Only in your local `.env`, never committed                    |
| `GOOGLE_MODEL`                 | `gemini-3.5-flash,gemini-3.5-flash-lite` | Gemini model(s), tried in order                               |
| `GROQ_API_KEY`                 | empty                                    | Groq key (free tier): the second model for claim verification |
| `GROQ_MODEL`                   | `openai/gpt-oss-120b`                    | Groq model used for verification                              |

## 8. Design system

Tokens in `src/styles/tokens.css`: colour, severity scale, typography, spacing, radii, glows, motion, layers.
Primitives in `src/ui`: Panel, QueryState, Loader, ErrorState, ErrorBoundary, ItemList, SeverityBadge.
Rule: CSS Modules + tokens only, no raw colours. Details: `docs/DESIGN_SYSTEM.md`.

## 9. Team ownership

**Build model:** Claude, running in Ayman's session, writes all the code. Each person below is the **decision owner**
for their area: Claude asks them the customization questions (layout, content, wording, interactions, data choices)
in plan mode before building, and they review and test the result. Teammates don't commit code. Full rule: `AGENTS.md` section 0.

Current roles (`tasks.json` → `team`):

| Person     | Role now                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **Hardik** | Reviews and merges every PR, runs sync points and the demo laptop                                   |
| **Affan**  | Decides AI behaviour and tone, provides the AI key, reviews AI output                               |
| **Arham**  | Decides visual direction, layout and globe look, reviews all UI                                     |
| **Ayman**  | Drives the Claude build session and relays decisions, decides the country, event and timeline views |
| **Shrey**  | Decides which countries and events feature, verifies researched facts, runs the demo rehearsal      |

The table below maps each area to its decision owner (the "Owns" column is the code area they decide on and review).

| Person                   | Primary responsibility                                               | Owns                                                                                                                                                      | Depends on                                            | Hands off to                                          |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **Hardik** (heavy)       | Integrator: merges, contracts, API server, live data, demo hardening | `shared/`, `server/` core + `routes/` + `sources/` + `store.ts`, `src/App.tsx`, `src/routes.ts`, `src/api/`, configs, `package*.json`, docs, `tasks.json` | Everyone's PRs                                        | Everyone (contract updates, merged main)              |
| **Affan** (heavy)        | AI: real provider, explanations, Ask ORBIT                           | `server/ai/`, `server/routes/ai.ts`, `src/features/insight/`, `src/features/ask/`                                                                         | Hardik (contract changes), Arham (primitives, layout) | Ayman/Arham (InsightCard), Hardik (AI cache for demo) |
| **Arham** (medium-heavy) | Design system, app shell, cinematic globe, global view               | `src/styles/`, `src/ui/`, `src/globe/`, `src/layout/`, `src/state/`, `public/`                                                                            | Shrey (data density), Hardik                          | Everyone (primitives)                                 |
| **Ayman** (medium)       | Country, event and timeline views                                    | `src/features/country/`, `src/features/event/`, `src/features/timeline/`                                                                                  | Arham (primitives), Affan (InsightCard), Shrey (data) | Arham (layout fit)                                    |
| **Shrey** (light)        | Curated data, news and health panels, demo script                    | `server/data/seed/`, `src/features/news/`, `src/features/health/`, `docs/DEMO.md`                                                                         | Hardik (contracts)                                    | Everyone (data), Hardik (demo script)                 |

Shared files that need coordination: see `AGENTS.md` section 3 ("Shared hot files").

## 10. Task system

`tasks.json` is the only list of work. Each task has:

| Field          | Meaning                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| `id`           | `ORB-<PERSON>-<NN>` (e.g. `ORB-ARH-03`). `ORB-000` = foundation                               |
| `owner`        | The one person responsible: decides and reviews if there is a `builder`, does the task if not |
| `builder`      | Present when Claude builds the task (in Ayman's session)                                      |
| `status`       | `todo`, `in_progress` or `done`. Hardik updates it on merge (tasks.json is a shared hot file) |
| `priority`     | `P0` demo breaks without it · `P1` should have · `P2` nice to have                            |
| `targetWindow` | Hours from the start (H0) when it should happen                                               |
| `branch`       | The Git branch to use                                                                         |
| `paths`        | The only files/folders the task may change                                                    |
| `dependsOn`    | Tasks that must be merged first                                                               |
| `acceptance`   | What "done" means                                                                             |
| `tests`        | Tests to add or keep green                                                                    |
| `handoff`      | Who to tell what when you finish                                                              |

Work order (Claude for built tasks, each person for their own tasks): P0 before P1 before P2, and within a priority, the earliest `targetWindow` whose
`dependsOn` tasks are done. `npm test` checks that `tasks.json` has valid IDs, owners and dependencies, with no cycles.

## 11. Dependency graph

```
ORB-000 foundation (done) ──► ORB-HAR-01 merge + setup check
                                   │
     ┌──────────────┬──────────────┼───────────────┬──────────────────┬───────────────┐
     ▼              ▼              ▼               ▼                  ▼               ▼
  Hardik          Affan          Arham           Ayman              Shrey          (all start
  HAR-02 sync     AFF-02 AI ◄─ AFF-01 key       ARH-01 design ──►   AYM-01 country  SHR-01 data ──► SHR-02 data
  HAR-03 live     AFF-03 insight  ARH-02 shell    ARH-04 global     AYM-02 event        │     SHR-03 panels
     │            AFF-04 ask      ARH-03 globe                      AYM-03 timeline     ▼
     │            AFF-05 cache ◄─ AFF-02                                            SHR-04 demo script
     │               │                                                                  │     ──► SHR-05 rehearsal
     └───────────────┴──────────────► ORB-HAR-04 demo hardening ◄──────────────────────┘
```

Right after ORB-HAR-01, **all five people can work in parallel**. ORB-AFF-01 (getting the AI key) can start at H0.

## 12. Git workflow (summary)

Branch from `main` using the task's `branch` name, then make small commits (`area: change`). Before the PR, `git pull origin main`
and run `npm run check`. The PR title is `[ORB-XXX-NN] summary`. Hardik squash-merges. Sync points happen every ~4h.
Full rules: `docs/INTEGRATION.md`.

## 13. Integration workflow

1. Contract/API changes merge first (Hardik) → everyone pulls.
2. Server changes merge next, then UI.
3. After each merge batch, Hardik runs `npm run check` + the click-through on `main`.
4. A broken `main` is fixed or reverted before new work continues.

## 14. Testing

| Layer       | Tests (existing)           | What they protect                                           |
| ----------- | -------------------------- | ----------------------------------------------------------- |
| Contracts   | `shared/contracts.test.ts` | ID, date, severity and event-kind rules                     |
| Data        | `server/data/seed.test.ts` | Every seed file is valid and every reference exists         |
| API         | `server/app.test.ts`       | Every route returns contract-valid `{ data }` / `{ error }` |
| Frontend    | `src/api/client.test.ts`   | Envelope unwrapping, error codes                            |
| Integration | `src/App.test.tsx`         | The real UI rendering real API data (globe mocked)          |
| Manifest    | `scripts/tasks.test.ts`    | `tasks.json` IDs, owners and dependencies                   |

Run all tests with `npm test` (or `npm run test:watch`). The gate is `npm run check`. Each task adds the tests listed in `tasks.json`.

## 15. Deployment plan

There is no cloud deployment. The demo runs with `npm run dev` on one laptop (ORB-HAR-04):

1. Pull the final `main`, `npm install`, `npm run check`.
2. Create the demo `.env` (`AI_PROVIDER=google` + key, `DATA_MODE=live` to warm caches).
3. Click through the full demo once online (fills `server/.cache/`), then **turn wifi off** and run it again.
4. Keep the backup recording (ORB-SHR-05) ready.

`npm run build` + `npm run preview` produces a static frontend build, but the API server is still needed, so we demo with `npm run dev`.

## 16. Coding-agent rules

`AGENTS.md` is read automatically by Codex and Cursor. `CLAUDE.md` imports it for Claude Code, and `.cursor/rules/orbit.mdc`
points Cursor to it. The key rules:

- Work on one task from `tasks.json`, inside its `paths`.
- Import types from `@shared` only, and never invent tasks, fields, routes or packages.
- Use CSS Modules + tokens, and handle loading, error and empty states.
- Never commit secrets, and run `npm run check` before a PR.

To start an agent session with the right context, use `docs/ALLOCATOR.md`.

## 17. Common mistakes to avoid

| Mistake                                           | Instead                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Writing `interface Country {...}` in a component  | `import { type Country } from '@shared'`                               |
| Naming a type `Event`                             | `OrbitEvent`                                                           |
| `fetch('/api/countries')` inside a component      | A hook in your feature folder using `apiGet(API_ROUTES.countries)`     |
| Hard-coding `'/country/' + id`                    | `paths.country(id)` from `src/routes.ts`                               |
| `color: #00e5ff`                                  | `color: var(--color-primary)`                                          |
| Installing a package without a plan               | State it in the plan, get Hardik's OK, install in the PR that needs it |
| Putting the AI key in code or a `VITE_` variable  | Local `.env` only                                                      |
| A teammate committing code "to fix a small thing" | Post it in the chat or a PR comment; Claude makes the change           |
| Country ID `in`, `India` or `ind`                 | `IND`                                                                  |
| Dates like `19/09/2026`                           | `2026-09-19T00:00:00Z`                                                 |
| Deleting a failing test                           | Fix the code, or ask                                                   |
| Working inside OneDrive                           | `C:\dev\orbit`                                                         |
| A long-lived branch                               | PR every 2–4 hours                                                     |

## 18. Definition of done

A task is done when:

- [ ] Every acceptance criterion in `tasks.json` is met
- [ ] The tests listed in the task exist and pass, and `npm run check` passes
- [ ] Only the task's `paths` changed
- [ ] The owner's customization decisions were asked in plan mode and are listed in the PR
- [ ] Loading, error and empty states are handled, using tokens and primitives only
- [ ] The PR is merged into `main` by Hardik, who sets `status` to `done` in `tasks.json`
- [ ] The handoff message is posted in the team chat

## 19. Personal LLM allocator

Each person pastes the prompt from `docs/ALLOCATOR.md` into their own LLM (Claude, ChatGPT, Cursor, Codex) with their name.
It reads `tasks.json` and these docs, then tells them their role, tasks, branch, files, dependencies,
acceptance criteria, tests and handoff. It never invents tasks.
