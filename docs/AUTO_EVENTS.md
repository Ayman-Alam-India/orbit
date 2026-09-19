# Automatic event detection

**The question:** "If there is a new headline tomorrow, does ORBIT pick it up on its own?"
**The answer:** yes. Live headlines were always automatic; since Review 2, ORBIT also turns them into
events on the globe by itself, marked as detected and unverified until a human confirms them.

## What is automatic, and what is not

| Layer                        | Automatic                                                        | Where                       |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------- |
| Headlines                    | Yes, GDELT per country, refreshed in the background (30 min)     | `server/sources/index.ts`   |
| Markets                      | Yes, Yahoo Finance (15 min)                                      | `server/sources/markets.ts` |
| Weather                      | Yes, Open-Meteo (30 min)                                         | `server/sources/weather.ts` |
| **Events on the globe**      | **Yes, detected from those headlines (20 min, or on demand)**    | `server/ingest/`            |
| Curated events, ripple links | No. Written and fact-checked by the team, and they win any clash | `server/data/seed/`         |

## The pipeline

```
GDELT headlines (already cached)
  → classify.ts   keyword rules → kind, category, severity; groups headlines about the same story
  → events.ts     drops anything close to a curated event
                  summary: Gemini writes one neutral sentence from the headline titles ONLY
                           (no key, or a figure that is not in the headlines → the headlines are quoted instead)
                  builds an OrbitEvent: origin 'auto', detectedAt, headlineUrls, source src_gdelt
  → OrbitEventSchema.safeParse   anything that does not match the contract is dropped
  → server/.cache/auto-events.json
```

Detection runs at most every 20 minutes in the background, and immediately when someone presses
**Scan now**. The UI never waits for it: the list answers from the last scan.

## The guardrails (say these when asked "can it make things up?")

1. **Only live, recent headlines** (last 5 days) from GDELT are considered.
2. **A headline must match a known kind of event** — outbreak, conflict, security, diplomacy, economy,
   disaster — otherwise it is skipped. Nothing is guessed.
3. **The title is the headline itself.** ORBIT does not write titles.
4. **The summary may only use the headline titles.** If the model's sentence contains a figure that is
   not in them, it is thrown away and the headlines are quoted verbatim instead.
5. **Curated wins.** A candidate that shares three significant words with a curated event is dropped.
6. **The contract decides.** Every candidate is validated against `OrbitEventSchema` before it is stored.
7. **Nothing is silently promoted.** Detected events show a purple pin, an "Auto-detected · unverified"
   badge, and live in their own "Detected by ORBIT" panel, separate from the curated ones.

Without an AI key the pipeline still runs: the classifier is plain keyword rules, so detection works
offline, and that is exactly what the tests exercise.

## API

| Route                   | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `GET /api/events/auto`  | The events from the last scan (empty in `DATA_MODE=mock`) |
| `POST /api/events/scan` | Runs a scan now and answers with what it found            |
| `GET /api/events/:id`   | Serves curated and detected events alike                  |

Events carry `origin: 'curated' | 'auto'`, plus `detectedAt` and `headlineUrls` when detected.

## Demoing it

1. `DATA_MODE=live` in `.env`, then `npm run dev`.
2. On the global view, find **Detected by ORBIT** in the right-hand column.
3. Press **Scan now** and talk while it works: "it is reading the live feed and proposing events".
4. Open one: the badge says auto-detected and unverified, and the sources link to the headlines it read.
5. The line that answers the review question: _"Headlines were always automatic. Now events are too —
   and we keep them visibly separate from the fact-checked ones, because detection is automatic and
   verification is not."_

## What we would do next

Run the detected events through the same three-way claim checker, and let a reviewer promote one to
curated from the UI, which would write it into the seed data with its sources.
