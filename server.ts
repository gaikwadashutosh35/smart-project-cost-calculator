import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { handleCheckPrices, handleExtract, handleReview, type ApiResult } from './claude';
import { rateLimit } from './rateLimit';
import { SECURITY_HEADERS, SITE, llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './seo';

const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;
const htmlRoot = isProd ? 'dist' : '.';

const app = express();
// Behind a load balancer / PaaS proxy, set TRUST_PROXY to the number of proxy hops so req.ip is the real client.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

// Security headers, shared with Netlify's _headers (seo.ts). Dev skips CSP/HSTS, which would block Vite's hot reload.
const siteHost = new URL(SITE).hostname;
const { 'Content-Security-Policy': _csp, 'Strict-Transport-Security': _hsts, ...DEV_HEADERS } = SECURITY_HEADERS;
app.use((req, res, next) => {
  res.set(isProd ? SECURITY_HEADERS : DEV_HEADERS);
  // Any host other than the real domain (e.g. *.onrender.com, *.fly.dev) duplicates the site: keep it out of search.
  if (isProd && req.hostname !== siteHost) res.set('X-Robots-Tag', 'noindex');
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

// Claude routes (same handlers as the Netlify functions in netlify/functions/).
const route = (handle: (body: unknown) => Promise<ApiResult>): express.RequestHandler => async (req, res) => {
  const r = await handle(req.body);
  res.status(r.status).json(r.body);
};
app.post('/api/extract', limits.extract, route(handleExtract));
app.post('/api/review', limits.review, route(handleReview));
app.post('/api/check-prices', limits.checkPrices, route(handleCheckPrices));

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
