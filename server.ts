import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ClaudeUnavailable, checkPrices, extractProject, reviewEstimate } from './claude';
import { rateLimit } from './rateLimit';
import { SITE, llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './seo';
import { AdvancedSchema, AnswersSchema, TIERS, WorkloadSchema } from './src/calc/types';
import { defaultWorkload } from './src/calc/workload';

const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;
const htmlRoot = isProd ? 'dist' : '.';

const app = express();
// Behind a load balancer / PaaS proxy, set TRUST_PROXY to the number of proxy hops so req.ip is the real client.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

// Security headers (the Express equivalent of a Cloudflare/Netlify _headers file).
const siteHost = new URL(SITE).hostname;
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
  if (isProd) {
    res.set({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    });
    // Any host other than the real domain (e.g. *.onrender.com, *.fly.dev) duplicates the site: keep it out of search.
    if (req.hostname !== siteHost) res.set('X-Robots-Tag', 'noindex');
  }
  next();
});
app.use(express.json({ limit: '50kb' }));

app.get('/robots.txt', (_req, res) => res.type('text/plain').send(robotsTxt()));
app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(sitemapXml()));
app.get('/llms.txt', (_req, res) => res.type('text/plain').send(llmsTxt()));
app.get('/llms-full.txt', (_req, res) => res.type('text/plain').send(llmsFullTxt(htmlRoot)));

const MINUTE = 60_000;
// Per-IP and overall caps per endpoint, sized to each call's cost. Tune here.
const limits = {
  extract: rateLimit({ perIp: 10, global: 200, windowMs: 10 * MINUTE }),
  review: rateLimit({ perIp: 5, global: 50, windowMs: 10 * MINUTE }),
  checkPrices: rateLimit({ perIp: 2, global: 10, windowMs: 60 * MINUTE }),
};

const ScenarioRequest = z.object({
  answers: AnswersSchema,
  workloadOverrides: WorkloadSchema.partial(),
  advanced: AdvancedSchema,
  tier: z.enum(TIERS),
});

/** Run a Claude task; map "not configured" and API errors to responses the client can show. */
async function claudeRoute(res: express.Response, task: () => Promise<unknown>) {
  try {
    return res.json({ available: true, result: await task() });
  } catch (error) {
    if (error instanceof ClaudeUnavailable || error instanceof Anthropic.AuthenticationError)
      return res.json({ available: false, error: 'Claude is not configured. Add ANTHROPIC_API_KEY to .env and restart the server.' });
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ available: true, error: 'Claude is rate-limited right now — try again in a minute.' });
    if (error instanceof Anthropic.APIError) {
      console.warn('Claude API error:', error.status, error.message);
      return res.status(502).json({ available: true, error: `Claude API error (${error.status ?? 'network'}). Try again.` });
    }
    console.warn('Claude task failed:', error);
    return res.status(502).json({ available: true, error: error instanceof Error ? error.message : 'Claude request failed.' });
  }
}

// Suggest questionnaire answers from a free-text description. The client asks the user to confirm before applying.
app.post('/api/extract', limits.extract, (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 2000) : '';
  if (!text.trim()) return res.status(400).json({ error: 'Description is required.' });
  return claudeRoute(res, () => extractProject(text));
});

function parseScenario(req: express.Request, res: express.Response) {
  const parsed = ScenarioRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid scenario.' });
    return null;
  }
  const { answers, workloadOverrides, advanced, tier } = parsed.data;
  return { answers, workload: { ...defaultWorkload(answers), ...workloadOverrides }, advanced, tier };
}

// Claude reviews workload assumptions and the chosen stack (never prices).
app.post('/api/review', limits.review, (req, res) => {
  const s = parseScenario(req, res);
  if (s) return claudeRoute(res, () => reviewEstimate(s.answers, s.workload, s.advanced, s.tier));
});

// Claude reads the official pricing pages for the services in this estimate and reports changed prices.
app.post('/api/check-prices', limits.checkPrices, (req, res) => {
  const s = parseScenario(req, res);
  if (s) return claudeRoute(res, () => checkPrices(s.answers, s.workload, s.advanced, s.tier));
});

async function startServer() {
  let vite: ViteDevServer | undefined;
  if (!isProd) {
    // 'mpa': each page has its own HTML (/, /calculator/, /about/); unknown paths fall through to the 404 below.
    vite = await createViteServer({ server: { middlewareMode: true }, appType: 'mpa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  // Real 404 status for unknown pages.
  app.use(async (req, res) => {
    let html = fs.readFileSync(path.resolve(htmlRoot, '404.html'), 'utf8');
    if (vite) html = await vite.transformIndexHtml(req.originalUrl, html);
    res.status(404).type('html').send(html);
  });

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Cloud Architecture & Cost Engine running on http://0.0.0.0:${port}`);
  });
}

startServer();
