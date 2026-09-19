# ORBIT: rules for coding agents and humans

This file is the single source of rules for Claude Code, Codex, Cursor and people. `CLAUDE.md` and
`.cursor/rules/orbit.mdc` only point here. If another document disagrees with this file, this file wins.
Tell Hardik so the other document gets fixed.

## 0. Before you change anything

1. Know **who you are working for** and **which task** (`tasks.json`, e.g. `ORB-AYM-01`). No task, no code.
2. Only edit files inside that task's `paths` and the owner's folders (section 3).
3. Run `npm run check` before every commit you intend to push.

## 1. What ORBIT is

An AI-powered global intelligence platform on a 3D globe: **Global → Country → Event → Explanation → Ask ORBIT**.
It's a 24-hour hackathon prototype, demoed live on one laptop, and it must work offline.

## 2. Stack (frozen, do not change or add alternatives)

| Area            | Choice                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Frontend        | Vite 8 + React 19 + TypeScript (strict)                                           |
| 3D globe        | react-globe.gl (three.js)                                                         |
| Server          | Express 5, run with tsx, in `server/`                                             |
| Contracts       | Zod 4 schemas in `shared/`, imported as `@shared`                                 |
| Data fetching   | TanStack Query (hooks live in each feature folder)                                |
| UI state        | Zustand (`src/state/`). The selection lives in the URL (`src/routes.ts`)          |
| Styling         | CSS Modules + tokens in `src/styles/tokens.css`                                   |
| AI              | Vercel AI SDK behind `server/ai/`, with the mock provider as default and fallback |
| Data            | JSON seed files in `server/data/seed/` + disk cache `server/.cache/`. No database |
| Tests           | Vitest + Testing Library                                                          |
| Package manager | **npm only** (one lockfile: `package-lock.json`). Node ≥ 22.12                    |

Do not introduce Next.js, Tailwind, Redux, a database, Python services, another package manager, or another app.

## 3. Folder ownership

Only the owner edits these folders. Everyone may **import** from anywhere, but must not **edit** outside their folders.

| Owner                   | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hardik** (integrator) | `shared/`, `server/app.ts`, `server/index.ts`, `server/env.ts`, `server/http.ts`, `server/testServer.ts`, `server/routes/` (except `ai.ts`), `server/data/store.ts`, `server/sources/`, `src/App.tsx`, `src/routes.ts`, `src/main.tsx`, `src/queryClient.ts`, `src/api/`, `src/test/`, `scripts/`, root config files, `package.json`, `package-lock.json`, `.env.example`, `tasks.json`, `AGENTS.md`, `CLAUDE.md`, `.cursor/`, `README.md`, `docs/` (except the files below) |
| **Affan**               | `server/ai/`, `server/routes/ai.ts`, `src/features/ask/`, `src/features/insight/`                                                                                                                                                                                                                                                                                                                                                                                            |
| **Arham**               | `src/styles/`, `src/ui/`, `src/globe/`, `src/layout/`, `src/state/`, `public/`, `docs/DESIGN_SYSTEM.md`                                                                                                                                                                                                                                                                                                                                                                      |
| **Ayman**               | `src/features/country/`, `src/features/event/`, `src/features/timeline/`                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Shrey**               | `server/data/seed/`, `src/features/news/`, `src/features/health/`, `docs/DEMO.md`                                                                                                                                                                                                                                                                                                                                                                                            |

**Never touch:** `mcp/`, `workshop-data/`, `.vscode/mcp.json` (hackathon organiser tooling).

**Shared hot files** (only change through a small, separate PR that Hardik merges first):
`shared/**`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/routes.ts`, `src/styles/tokens.css`,
`src/ui/index.ts`, `server/app.ts`, `.env.example`, `tasks.json`, `AGENTS.md`.

## 4. Shared contracts (`shared/`)

- Every data type is defined **once**, as a Zod schema in `shared/schemas/`: `XSchema` + `type X = z.infer<typeof XSchema>`.
- Import types and schemas only from `@shared`: `import { type Country, API_ROUTES } from '@shared'`.
- **Never** write your own `interface Country`, `type Event`, etc. **Never** name a type `Event` (it clashes with the DOM). Use `OrbitEvent`.
- IDs: countries = ISO alpha-3 uppercase (`IND`). Everything else = prefix + lowercase slug:
  `evt_` geopolitical event, `hs_` health signal, `news_`, `src_`, `tl_`, `ins_`.
- Dates: ISO 8601 UTC strings (`2026-09-19T10:00:00Z`). Coordinates: `{ lat, lng }`. Severity: integer 1–5.
- Fields: camelCase. Enum values: lowercase strings.
- Changing a contract: follow `docs/INTEGRATION.md#contract-changes`. New fields start as `.optional()`.

## 5. API rules

- All routes are listed in `docs/API.md` and built with `API_ROUTES` from `@shared`. Never hand-type `/api/...` strings.
- Success responses: `{ "data": ... }`. Error responses: `{ "error": { "code", "message" } }` plus an HTTP status.
- Server: validate every input with `parseInput(schema, value)`. Throw `AppError` / `notFound()` (in `server/http.ts`). Never `res.status(...).json(...)` by hand.
- Frontend: the only `fetch` calls live in `src/api/client.ts`. Features call `apiGet`/`apiPost` inside TanStack Query hooks in their own folder.
- Query keys start with the feature name (`['country', id]`) so features never collide.
- Only the server talks to external APIs or AI providers. The browser never does.

## 6. Environment and secrets

- Real values go in a local `.env` (gitignored). `.env.example` lists every variable with a safe empty or default value.
- **Never** commit keys, tokens or `.env`. **Never** put a secret in a `VITE_` variable (those ship to the browser).
- Adding a variable: add it to `.env.example` **and** `server/env.ts` in the same PR (Hardik merges).

## 7. Dependencies

- Do not run `npm install <package>`. Ask Hardik in the chat, with the package name and why. Hardik installs, commits the lockfile, and everyone pulls.
- Everyone else only runs plain `npm install` (after pulling) to sync.
- Never delete or regenerate `package-lock.json`. Never use yarn, pnpm or bun.

## 8. Styling rules

- CSS Modules only: `Component.module.css` next to `Component.tsx`. No global class names except in `src/styles/global.css`.
- Use tokens: `var(--color-primary)`, `var(--space-4)`… **No raw hex colours, px font sizes or shadows outside `tokens.css`.**
- Canvas/WebGL code reads tokens with `cssVar()` from `src/styles/cssVar.ts`.
- Reuse primitives from `src/ui` (Panel, Loader, ErrorState, ErrorBoundary, QueryState, ItemList, SeverityBadge). Need a new one? Ask Arham.
- Details: `docs/DESIGN_SYSTEM.md`.

## 9. Error handling

- Every query renders loading **and** error states. Use `<QueryState query={...} label="...">`.
- Wrap each feature section in `<ErrorBoundary title="...">` so one crash never blanks the app.
- Server: never crash on bad data from a live source or AI. Log `[sources] ...` / `[ai] ...` and fall back (cache → seed / mock).
- Logging uses a prefix: `[api]`, `[sources]`, `[ai]`, `[ui]`.

## 10. Testing

- `npm run check` = lint + tests + typecheck/build. It must pass before every PR.
- Each task lists the tests it needs in `tasks.json`. Put tests next to the code (`X.test.ts(x)`).
- Server/shared tests start with `// @vitest-environment node`. Frontend tests use `renderWithProviders` from `src/test/utils.tsx`.
- The globe is mocked in tests (no WebGL in jsdom). Do not remove that mock.

## 11. Git workflow

- `main` must always run. Only Hardik merges (Affan is backup).
- Branch per task: the `branch` field in `tasks.json` (`<name>/<topic>`, e.g. `arham/globe`).
- Commit messages: `<area>: <what changed>` (e.g. `globe: add severity rings`). Small commits.
- Before opening a PR: `git pull origin main`, fix conflicts in YOUR files only, run `npm run check`.
- PR title: `[ORB-XXX-NN] short summary`. Squash merge.
- Full rules: `docs/INTEGRATION.md`.

## 12. What agents must NOT do

- Invent tasks, features, routes, fields or packages that are not in `tasks.json` / `docs/API.md`.
- Edit files outside the current task's owner folders "while they're at it".
- Change the stack, add a framework, or restructure folders.
- Disable lint rules, delete tests or loosen TypeScript to make `npm run check` pass.
- Commit `.env`, keys, `dist/`, `server/.cache/` or `node_modules/`.
