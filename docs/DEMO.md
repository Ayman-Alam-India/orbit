# ORBIT demo script (3 minutes)

The path: **Global → Country (India) → Article → Event → Explanation → Ask ORBIT → What if**.
Live items (headlines, detected events) change every 10 minutes, so the script names the curated and
official items that are always there, and says "pick a current one" where the news decides.

## Before the demo (30 minutes ahead)

1. `.env` on the demo laptop: `DATA_MODE=live`, `AI_PROVIDER=google`, both keys set
   (`GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`). `GOOGLE_MODEL=gemini-3.5-flash-lite,gemini-3.5-flash`.
2. `npm run dev`, open http://localhost:5173 and leave it running for at least one full pass (about 3 minutes).
3. Hover the **status light** in the top bar. You want green **Live · x min ago** and ✓ on Google News, WHO,
   Indian fuel prices and Groq. Gemini may show ✗ when the free daily quota is used up; ORBIT falls back
   cleanly (template explanations, Groq-only checks), so the demo still works.
4. Click once through the path below so the article preview and insights are cached (they then open instantly,
   even if the wifi drops).
5. Close every other app that uses the network; turn notifications off.

## The 3 minutes

| Time | Do                                                                                                                                     | Say                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Global view. Let the globe turn. Point at the **status light**.                                                                        | "ORBIT reads the world's news, WHO outbreak reports, markets and fuel prices every ten minutes, for 52 countries. The light says it's live."                              |
| 0:15 | Point at the **pins**: red/orange are severe, violet are detected by ORBIT. Point at the arcs.                                         | "Every pin is an event. Every arc is a ripple: how an event in one country reaches another."                                                                              |
| 0:25 | **Ripple legend** (left): click **Health · outbreaks**.                                                                                | "Here are only the health ripples: WHO's Ebola report links DR Congo, Kenya, Nigeria and Uganda. Each pin is an official WHO report." Click the colour again to show all. |
| 0:40 | Search **India** (or click it). Country view.                                                                                          | "Now India."                                                                                                                                                              |
| 0:45 | **Markets**: point at petrol and diesel for Delhi, Mumbai, Kolkata, Chennai.                                                           | "Today's pump prices in the four metros, updated every morning, with the last ten days."                                                                                  |
| 0:55 | **Headlines**: point at **Important** and the **trust badges** (✓ ◑ ○).                                                                | "Every headline is ranked and rated by one rule. ◑ means three or more independent outlets report it, at least one established, and the AI checkers agree."               |
| 1:05 | Click an **Important** headline. The **article preview** opens with the article's photo.                                               | "We open the article inside ORBIT, with its own photo or video."                                                                                                          |
| 1:15 | Open **How we know**.                                                                                                                  | "And we show our working: which outlets reported it, which ones are only copies of a wire story and don't count, and what Gemini and Groq concluded."                     |
| 1:25 | Close (Esc). Find a **○ Unverified** headline, click **Verify now**.                                                                   | "Anything unconfirmed can be checked on the spot: ORBIT searches again and asks the AI checkers."                                                                         |
| 1:40 | Back on India, scroll to **Ripple effects**: "Higher crude import bill", then click **From: Houthis seize Red Sea islands…**           | "India isn't in this conflict, but it feels it. Here's the event, verified by ORBIT's team."                                                                              |
| 1:50 | On the event, the **Ripple effects** chain: Red Sea → Brent → India's crude bill → rupee and Delhi petrol, with the live Brent figure. | "Each ripple has its mechanism and its source, and the live market number that shows it."                                                                                 |
| 2:05 | **ORBIT explains**.                                                                                                                    | "The AI briefing leads with what's current and cites its sources."                                                                                                        |
| 2:15 | **Ask ORBIT** (top right): _"How does the Red Sea crisis affect fuel prices in India?"_                                                | "And you can just ask."                                                                                                                                                   |
| 2:35 | **What if…** (top bar): pick **Strait of Hormuz**, drag the shock to +40%.                                                             | "What if Hormuz closes? Twelve scenarios, each with sourced facts. This is arithmetic on live numbers, clearly labelled a simulation, not a forecast."                    |
| 2:55 | Back to the globe.                                                                                                                     | "ORBIT: what's happening, why it matters, and how we know."                                                                                                               |

## If something goes wrong

- **No wifi:** keep going. Everything already loaded is cached, and live mode shows the last saved data
  (the light turns amber). For a fully offline run, set `DATA_MODE=mock` and restart: curated data only.
- **Gemini out of quota:** nothing to do. The light shows it; explanations use templates and checks use Groq.
- **An article preview has no photo:** say "this outlet doesn't publish a preview image" and open another.
- **A panel shows an error:** each panel fails on its own; carry on with the next step.
- **The globe is blank:** reload the page (the API keeps running).

## Questions that work well in Ask ORBIT

- "How does the Red Sea crisis affect fuel prices in India?"
- "What is happening with the Ebola outbreak?"
- "Which countries depend most on the Strait of Hormuz?"
- "What are the most important stories in India today?"
