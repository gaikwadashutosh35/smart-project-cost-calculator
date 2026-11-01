import express from 'express';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { z } from 'zod';
import { ClaudeUnavailable, checkPrices, extractProject, reviewEstimate } from './claude';
import { rateLimit } from './rateLimit';
import { AdvancedSchema, AnswersSchema, TIERS, WorkloadSchema } from './src/calc/types';
import { defaultWorkload } from './src/calc/workload';

dotenv.config();

const app = express();
// Behind a load balancer / PaaS proxy, set TRUST_PROXY to the number of proxy hops so req.ip is the real client.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(express.json({ limit: '50kb' }));

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

const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Cloud Architecture & Cost Engine running on http://0.0.0.0:${port}`);
  });
}

startServer();
