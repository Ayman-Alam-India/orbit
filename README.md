# Incident Console

A React + TypeScript + Vite workshop playground for moving from chat to agent workflows, tests, tools, and MCP.

## Run it

```bash
npm install
npm run dev
```

Useful checks: `npm run test`, `npm run build`, and `npm run lint`.

The app contains intentionally seeded behavioral bugs. The baseline test suite passes while those bugs remain. See [solutions.md](solutions.md) for facilitator notes and repair guidance.

## Workshop map

- Dashboard, incident list, detail, services, and settings routes
- TanStack Query data flow with seeded pagination and mutation exercises
- Testing Library/Vitest baseline, including a deliberately weak test
- MSW handlers in `src/mocks`
- Local MCP data under `workshop-data/` and a stdio server in `mcp/server.mjs`
- VS Code MCP registration in `.vscode/mcp.json`

MCP tools: `list_incidents`, `get_incident`, `list_service_health`, `get_recent_deploys`, and `search_logs`.
