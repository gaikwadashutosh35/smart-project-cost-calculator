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

## Deploy (Netlify)

`netlify.toml` builds with `npm run build` and publishes `dist/`. The build also writes `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` and `_headers` (security headers, asset caching) into `dist/`. The Claude features run as Netlify Functions in `netlify/functions/` at the same `/api/...` paths, using the same handlers as the Express server (`claude.ts`).

1. In Netlify, add a site from the Git repository (build settings come from `netlify.toml`).
2. Site configuration → Environment variables: set `ANTHROPIC_API_KEY` (scope must include Functions) and `SITE_URL` (your domain, e.g. `https://example.com`). Values in `netlify.toml` are not available to functions.
3. Add the custom domain, then uncomment the redirect in `netlify.toml` so the `*.netlify.app` address forwards to it.
4. In the Claude Console, set a monthly spend limit for the API key's workspace. It is the only hard cost cap (see below).

Until `SITE_URL` is set, every page is served with `X-Robots-Tag: noindex`, so a placeholder domain never gets indexed.

Deploying from your machine, build first and then deploy that output:

```bash
npx netlify-cli build
```

```bash
npx netlify-cli deploy --prod
```

`netlify build` runs `npm run build` with the site's Netlify environment variables (`SITE_URL`). Don't rely on `netlify deploy --build` alone: the CLI reads `dist/_headers` before its build step, so a stale file from an earlier local build (for example one with `noindex`) can be deployed. Test on a free draft deploy (`netlify deploy`, without `--prod`) before spending a production deploy.

**Netlify limits that shape this setup** (checked 2026-11-02):
- Functions have a fixed 60-second limit. The live price check reads at most 8 pricing pages per run (`MAX_PRICE_PAGES` in `claude.ts`) to stay under it; the rest are reported as skipped.
- Rate limits are set in each function's `config`: price check 1 per visitor per 3 minutes, review 3 per 3 minutes. Description suggestions are not limited (about 1 cent each). The Free plan allows 2 rules per project and windows of at most 180 seconds, and there is no site-wide cap below Enterprise — hence the Claude Console spend limit.
- Free plan: 300 credits a month. Each production deploy costs 15 credits and bandwidth 20 credits per GB. When credits run out, all sites on the account are paused until the next month, so avoid deploying on every small change.

### Alternative: any Node host

```bash
npm run build
NODE_ENV=production npx tsx server.ts   # serves dist/ and the API on $PORT (default 3000)
```

Works on Render, Fly.io, Railway or Cloud Run. The Express server serves the same pages and API, with its own in-memory rate limits (`rateLimit.ts`, limits at the top of `server.ts`: suggestions 10 per IP / 200 total per 10 min, reviews 5 / 50 per 10 min, price checks 2 / 10 per hour). Behind a proxy, set `TRUST_PROXY` to the number of proxy hops (usually `1`).

## SEO

Pages: `/` (static landing page, indexable), `/supabase-pricing-calculator/` (Supabase-only calculator with generated pricing tables, indexable), `/guides/supabase-vs-neon-pricing/` (comparison guide, indexable), `/about/` (method and every pricing source, indexable), `/calculator/` (the app, `noindex, follow`: its content is rendered by JavaScript, so the landing page is the one that ranks), plus a real `404`.

- Set `SITE_URL` (see `.env.example`) to the live origin. It feeds canonical URLs, Open Graph tags, JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt`. Until the request host matches it, production responses carry `X-Robots-Tag: noindex`, so preview hosts (`*.onrender.com`, `*.fly.dev`) stay out of search.
- `robots.txt`, `sitemap.xml`, `llms.txt` and `llms-full.txt` are served by `server.ts` from `seo.ts`. When you change a page's content, update its `modified` date in `seo.ts` and its visible "Updated" date and JSON-LD `dateModified`.
- The pricing-sources table on `/about/` is generated from the catalogue at build time.
- Keyword research: `seo/keywords-2026-11-02.csv`; content briefs: `seo/briefs/`.
- Pricing tables, worked examples and catalogue counts on these pages are generated from the catalogue at build time (`fillPlaceholders` in `seo.ts`). `compare.test.ts` fails if a price change alters totals that page prose quotes: update the text and its dates together.

After the first deploy on the real domain:

1. Search Console: add a Domain property (DNS TXT), submit `/sitemap.xml`, request indexing for `/` and `/about/`.
2. Bing Webmaster Tools: import from Search Console.
3. IndexNow: add a 32-hex key file to `public/` and ping it after each deploy.
4. Analytics: a cookie-free counter (e.g. Cloudflare Web Analytics) plus GA4 behind consent if you need traffic sources. Add their domains to the CSP in `server.ts`.
5. Validate JSON-LD with the Rich Results Test; check the social card with a link preview.

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
index.html, about/, calculator/, supabase-pricing-calculator/, guides/, 404.html
                     static pages (landing, method, app entry, Supabase calculator, guides, not found)
seo.ts               site URL, page list, robots / sitemap / llms.txt generators, sources table
server.ts            Express: Claude routes, SEO files, security headers, 404 + Vite / static hosting
claude.ts            Claude API calls (structured outputs, refusal fallback, web fetch) + HTTP handlers shared by Express and Netlify
netlify/functions/   Netlify Functions for /api/extract, /api/review, /api/check-prices (rate limits in each config)
netlify.toml         Netlify build settings
```

## Licence

MIT — see [LICENSE](LICENSE). Contributors follow the [Code of Conduct](CODE_OF_CONDUCT.md). Hosted on [Netlify](https://www.netlify.com).
