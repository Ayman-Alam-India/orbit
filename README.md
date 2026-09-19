# ORBIT

AI-powered global intelligence on an interactive 3D globe: geopolitical and health signals, news, history and
explainable AI, in one flow: **Global → Country → Event → Explanation → Ask ORBIT**.

Built in 24 hours by Arham, Ayman, Affan, Shrey and Hardik. This README is the team's starting point, and each section
links to the document that holds the full detail.

## Quick start

Requirements: **Node 22.12+** (team uses 24; see `.nvmrc`), npm, Git. Keep the repo **outside OneDrive** (e.g. `C:\dev\orbit`).

```powershell
git clone https://github.com/Ayman-Alam-India/orbit C:\dev\orbit
cd C:\dev\orbit
npm install
copy .env.example .env    # optional: every value has a safe default
npm run dev               # open http://localhost:5173
```

`npm run dev` starts two processes, `[web]` (Vite on :5173) and `[server]` (the API on :8787). The browser calls `/api/...`
and Vite forwards it to the API server. Everything works offline with mock data and a mock AI.

## Commands

| Command                               | What it does                                                |
| ------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                         | Web + API servers with hot reload                           |
| `npm run dev:web` / `npm run dev:api` | Only one of them                                            |
| `npm test` / `npm run test:watch`     | Vitest: contracts, seed data, API, frontend, tasks.json     |
| `npm run lint`                        | ESLint                                                      |
| `npm run build`                       | Typecheck everything (`tsc -b`) + production frontend build |
| `npm run check`                       | **lint + test + build. Must pass before every PR**          |
| `npm run format`                      | Prettier                                                    |
| `npm run docs:pdf`                    | Rebuild `docs/ORBIT-Playbook.pdf` from the Markdown docs    |

## Architecture

```
Browser (React + 3D globe) ──/api──► Express API server ──► seed JSON (always) + live sources (cached) + AI (or mock)
                 └──────────── shared/ Zod contracts used by both sides ────────────┘
```

- **Frontend** (`src/`): Vite, React 19, TypeScript, react-globe.gl, TanStack Query, Zustand, CSS Modules + design tokens.
- **API** (`server/`): Express 5 run with tsx. It validates the seed data at startup, keeps keys server-side, and falls back to cache or seed when live data fails.
- **Contracts** (`shared/`): one Zod schema per entity (Country, OrbitEvent, NewsHeadline, Source, TimelineEvent, AIInsight).
- **AI** (`server/ai/`): the mock provider by default. Gemini via the Vercel AI SDK when a key is configured, falling back to mock on any failure.

Details: [docs/PLAYBOOK.md](docs/PLAYBOOK.md#2-architecture).

## Repository structure

```
shared/          Contracts (schemas + API routes)        server/        API server, seed data, AI, live sources
src/             Frontend (layout, globe, features, ui)  public/data/   Country shapes for the globe
docs/            Team documentation + PDF                scripts/       Tooling
tasks.json       Task manifest                           AGENTS.md      Rules for people and coding agents
mcp/, workshop-data/   Hackathon organiser tooling: do not modify
```

Full map: [docs/PLAYBOOK.md](docs/PLAYBOOK.md#4-repository-map).

## Shared contracts

Types come only from `@shared` (`import { type Country, API_ROUTES } from '@shared'`).

| Rule        | Value                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Country IDs | ISO alpha-3, uppercase: `IND`                                          |
| Other IDs   | Prefix + lowercase slug: `evt_`, `hs_`, `news_`, `src_`, `tl_`, `ins_` |
| Dates       | ISO 8601 UTC: `2026-09-19T10:00:00Z`                                   |
| Coordinates | `{ lat, lng }`                                                         |
| Severity    | Integer 1–5                                                            |
| Responses   | `{ data }` or `{ error: { code, message } }`                           |

API routes, entity fields and the mock-data format: [docs/API.md](docs/API.md).

## Environment variables

Defined in `.env.example` (committed) and parsed in `server/env.ts`. Put real values in a local `.env`, which is never committed.

| Variable                       | Default | Meaning                                                |
| ------------------------------ | ------- | ------------------------------------------------------ |
| `PORT`                         | `8787`  | API server port                                        |
| `DATA_MODE`                    | `mock`  | `mock` = seed data only · `live` = seed + live sources |
| `AI_PROVIDER`                  | `mock`  | `mock` or `google`                                     |
| `GOOGLE_GENERATIVE_AI_API_KEY` | empty   | Gemini key, only in your local `.env`                  |

Secrets never go in code, commits, chat, or `VITE_` variables.

## Team and ownership

**Build model:** Claude, running in Ayman's session, writes all the code. Each teammate is the **decision owner** for an area:
Claude asks them the customization questions (layout, content, wording, interactions, data) before building, and they review
and test the result. Teammates don't commit code; they comment on PRs or post in the chat. See [AGENTS.md](AGENTS.md#0-build-model-one-code-writer).

| Person              | Decides and reviews                                          |
| ------------------- | ------------------------------------------------------------ |
| Hardik (integrator) | Reviews and merges every PR, sync points, the demo laptop    |
| Affan               | AI behaviour and tone (provides the AI key)                  |
| Arham               | Visual direction, layout, globe look                         |
| Ayman               | Drives the Claude session; country, event and timeline views |
| Shrey               | Featured countries and events, fact checks, demo rehearsal   |

The folder-to-owner map and the shared files that need a separate PR are in [AGENTS.md](AGENTS.md#3-folder-ownership-decision-owners).

## Task system

All work is listed in [`tasks.json`](tasks.json): ID, owner, priority, branch, allowed paths, dependencies, acceptance criteria,
tests and handoff. To find out what to do, paste the prompt from [docs/ALLOCATOR.md](docs/ALLOCATOR.md) into your LLM
with your name. Explanation of the fields and the dependency graph: [docs/PLAYBOOK.md](docs/PLAYBOOK.md#10-task-system).

## Git workflow

1. `git checkout main && git pull`, then `git checkout -b <branch from tasks.json>`
2. Small commits: `area: what changed`
3. `git pull origin main` and `npm run check`
4. PR titled `[ORB-XXX-NN] summary`. Hardik squash-merges.

Contract changes, conflicts and what never gets committed: [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Documentation

| Document                                           | For                                                         |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                             | Rules (read by Claude Code via `CLAUDE.md`, Codex, Cursor)  |
| [docs/PLAYBOOK.md](docs/PLAYBOOK.md)               | Everything in one place                                     |
| [docs/API.md](docs/API.md)                         | API and data contract                                       |
| [docs/INTEGRATION.md](docs/INTEGRATION.md)         | Branches, PRs, contract changes                             |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)     | Tokens, primitives, UI conventions                          |
| [docs/ALLOCATOR.md](docs/ALLOCATOR.md)             | Personal LLM task allocator                                 |
| [docs/ORBIT-Playbook.pdf](docs/ORBIT-Playbook.pdf) | Printable reference (generated, the Markdown is the source) |

Country shapes: [Natural Earth](https://www.naturalearthdata.com/) 1:110m admin-0 countries (public domain), via the
globe.gl examples.
