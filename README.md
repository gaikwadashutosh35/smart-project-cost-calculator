# Smart Project Cost Calculator

Describe what you want to build, how many people will use it and your budget. The calculator picks the infrastructure for you and shows a transparent monthly / annual cost estimate — no cloud knowledge needed.

## What it does

1. **Four-step questionnaire:** project type, features (with optional free-text description → suggested answers), users and traffic, AI usage (skipped if you don't need AI), budget and preferences.
2. **Editable workload assumptions:** MAU vs registered users, requests, DB operations, storage, bandwidth, peak traffic.
3. **Three architectures** (Budget / Recommended / Scalable), each with its stack, monthly and annual cost, advantages, limitations and upgrade notes. The option that fits your priority and budget is highlighted.
4. **Per-service breakdown:** provider, plan, purpose, why it's needed, usage assumed, every billable line with its formula, pricing status (verified / estimate / your price / unavailable), official pricing link, last-checked date, lock-in and alternatives.
5. **What-if growth simulator:** re-runs the full estimate at 100 → 100,000+ users (free tiers run out, plans step up, instances scale with peak traffic).
6. **Advanced mode:** every workload number, provider/plan per component, instance count, AI models and routing, MCP/agent settings, manual unit-price overrides — all fed to the same engine.
7. **Exports:** PDF report (browser print → Save as PDF), CSV line-item breakdown, share link (scenario encoded in the URL hash, never sent to a server), copyable text summary, saved / duplicated scenarios (browser localStorage).

## Design

Visual style follows the Stripe DESIGN.md from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (an independent analysis, not affiliated with Stripe): tokens live in `src/index.css` (`@theme`), shared components in `src/ui/kit.tsx`. Inter stands in for Stripe's proprietary typeface. Chart series colours use a separately validated colour-blind-safe palette.

## Pricing data

`src/calc/catalog.ts` holds every price with its official source URL and the date it was checked (2026-11-01). Entries the official page did not confirm are marked `estimate` and shown as such in the UI. Exchange rates are ECB reference rates (2026-10-30). Payment gateway fees are a % of revenue and excluded from infrastructure totals. Taxes are excluded.

To update prices, edit `catalog.ts` (and `CHECKED` / `FX_*`), then run the tests.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 (Express + Vite)
npm test           # unit + flow tests for the calculation engine
npm run lint       # type-check
```

Optional: set `ANTHROPIC_API_KEY` in `.env` (see `.env.example`) to turn on Claude (Opus 5.5):

- **Suggest answers from description**: Claude fills project type, features, users, usage, geography, AI needs and cloud preference.
- **Review my estimate**: Claude checks workload assumptions and the chosen stack and proposes edits. It never produces prices.
- **Check prices live**: Claude reads the official pricing pages for the services in the estimate and reports changed prices with a quote; accepted ones become your price overrides. Slower and uses more API credits.

Nothing Claude suggests is applied until you click Apply. Without a key the app works as before (keyword matching, no review). The key stays on the server. Requests use `fallbacks: "default"` so a refused request is retried server-side on Anthropic’s recommended fallback model.

## Deploy

```bash
npm run build
NODE_ENV=production npx tsx server.ts   # serves dist/ and the API on $PORT (default 3000)
```

Any Node 20+ host works (Render, Fly.io, Railway, Cloud Run). Set `ANTHROPIC_API_KEY` as a secret if you want the Claude features.

The Claude routes are rate-limited per IP and overall (limits at the top of `server.ts`): description suggestions 10 per IP / 200 total per 10 min, reviews 5 / 50 per 10 min, live price checks 2 / 10 per hour. Over the limit, they return `429` with `Retry-After`. Limits are kept in memory, so they apply per server process and reset on restart. Behind a proxy or load balancer (Render, Fly.io, Cloud Run…), set `TRUST_PROXY` to the number of proxy hops (usually `1`) so limits apply per visitor instead of to everyone at once. There's no login, so also set a monthly spend limit for your API key's workspace in the Claude Console as a hard backstop.

## Code layout

```
src/calc/            framework-free logic (unit tested)
  types.ts           zod schemas + shared types
  questionnaire.ts   options, feature relevance, local description extraction
  workload.ts        answers → workload assumptions → derived monthly totals
  catalog.ts         pricing catalogue (sources, dates, status), AI models, FX
  recommend.ts       which services each architecture needs, and why
  engine.ts          plan selection, free tiers, tiers, overrides, AI tokens, totals
  export.ts          CSV, text summary, share links, money formatting
src/ui/              React components (wizard, results, simulator, advanced mode, print report)
server.ts            Express: Claude routes (/api/extract, /api/review, /api/check-prices) + Vite / static hosting
claude.ts            Claude API calls (structured outputs, refusal fallback, web fetch for price checks)
```
