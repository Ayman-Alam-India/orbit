# ORBIT integration contract

Owner: Hardik. This document describes how work becomes one working ORBIT app without breaking it.

**Build model:** Claude (in Ayman's session) is the only code writer (`AGENTS.md` section 0). Before each task, Claude asks the
task owner the customization questions in plan mode. Teammates review PRs, test, and propose changes as PR comments or in the
chat, never as commits. The steps below are what Claude follows. Hardik still reviews and merges everything.

## The flow

```
main ──► your branch (from tasks.json) ──► commits ──► pull main + npm run check ──► PR ──► Hardik merges (squash) ──► main
```

1. `git checkout main && git pull` then `git checkout -b <branch from tasks.json>` (e.g. `claude/country-view`).
2. Ask the task owner the customization questions (plan mode), then work only inside the task's `paths` (see `tasks.json` and `AGENTS.md` section 3).
3. Commit small and often.
4. Before the PR: `git pull origin main` (merge main into your branch), resolve conflicts, `npm run check`.
5. Open a PR into `main`. Hardik reviews, merges (squash), and posts in the chat.
6. Everyone: `git checkout main && git pull && npm install`, then start the next task on a new branch.

## Branch naming

Exactly as in the task's `branch` field: `claude/<short-topic>` for Claude-built tasks. Examples: `claude/globe`, `claude/google-provider`.
Use one branch per task and delete it after merge. Never commit directly to `main`.

## Commits

- Format: `<area>: <what changed>` in the present tense, e.g. `country: show risk level`, `seed: add 10 countries`.
- One logical change per commit. Never commit generated or secret files (see "Never commit").

## Pull requests

- Title: `[ORB-XXX-NN] short summary`, e.g. `[ORB-AYM-01] Country view`.
- The description says: the owner's customization decisions, what changed, how to test it (the click path), the tests you added, and any contract/API changes
  (these should already be merged separately), plus screenshots for UI.
- Keep PRs small: one task per PR. A PR that changes files outside its task's `paths` is sent back.
- Checklist before requesting a merge:
  - [ ] `npm run check` passes
  - [ ] Only my task's `paths` changed (plus tests)
  - [ ] Loading / error / empty states handled
  - [ ] Customization decisions came from the task owner and are listed
  - [ ] No secrets, no `.env`, no new packages (unless stated in the plan and OK'd by Hardik)

## Shared-file rules

Shared hot files (`AGENTS.md` section 3): `shared/**`, `package.json`, `package-lock.json`, `src/App.tsx`, `src/routes.ts`,
`src/styles/tokens.css`, `src/ui/index.ts`, `server/app.ts`, `.env.example`, `tasks.json`, `AGENTS.md`.

- Change them in a **separate small PR** that is merged **before** the feature PR that needs it.
- Everything else **imports** from them freely.

## Contract changes

A contract change is any change to `shared/` (a field, schema, enum, ID rule, route or response shape).

1. **Announce** in the team chat: `CONTRACT CHANGE: add optional imageUrl to Country, needed for ORB-AYM-01`.
2. **Claude** makes the change in one PR: `shared/` + `docs/API.md` + the server route or seed validation + tests.
   New fields start as `.optional()`, so existing data and code keep working.
3. Hardik merges it and posts `CONTRACT UPDATED: ... pull main`.
4. Everyone pulls main. Then the feature PR uses the new field.

Never change the meaning of an existing field and never delete a field while someone uses it. Add a new field instead.

## API changes

Same process as contract changes. New routes are added to `API_ROUTES` (`shared/api.ts`) and the routes table in `docs/API.md`
in the same PR as the server code. Frontend code uses a new route only after that PR is on `main`.

## How conflicts are avoided

- One code writer (Claude in Ayman's session), so there are no parallel edits to the same file.
- One task per branch, and each task only touches its own `paths`.
- All routes are declared up front in `src/App.tsx`, so features never touch the router.
- Each feature has its own query hooks and keys. There is no shared query key file.
- Packages are only added in the PR that needs them, so there are no lockfile conflicts.
- CSS Modules per component, so there are no global CSS conflicts.

Teammates never commit, so if a teammate wants a change, they post it as a PR comment or in the chat.

## Testing before merging

The author runs `npm run check` (lint, tests, typecheck, build) and clicks through their change in `npm run dev`.
Hardik runs `npm run check` on `main` after each merge batch and clicks Global → Country → Event → Ask (task ORB-HAR-02).
If `main` breaks, fixing it comes before any new work. Revert the PR if it can't be fixed in 15 minutes.

## Sync points

About every 4 hours (task ORB-HAR-02), Hardik merges ready PRs in order (`shared/` changes first, then server, then UI),
and everyone pulls and tests on their own laptop. Branches stay short-lived.

## Never commit

- `.env` or any real key or token (only `.env.example` with empty values)
- `node_modules/`, `dist/`, `server/.cache/`
- Another lockfile (`yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`)
- Files outside your task's paths, or edits to `mcp/` and `workshop-data/`
- Commented-out code blocks, `console.log` debugging left behind, disabled tests or lint rules
