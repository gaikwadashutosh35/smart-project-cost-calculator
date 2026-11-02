import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capPages, type PriceItem } from '../../claude';
import checkPrices, { config as checkConfig } from '../../netlify/functions/check-prices.mts';
import extract from '../../netlify/functions/extract.mts';
import review, { config as reviewConfig } from '../../netlify/functions/review.mts';
import { DEFAULT_ANSWERS, DEFAULT_FEATURES } from './questionnaire';

delete process.env.ANTHROPIC_API_KEY; // never call the real API from tests
delete process.env.ANTHROPIC_AUTH_TOKEN;

const post = (body: unknown) => new Request('https://site.test/api/x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

test('price check reads at most N distinct pages', () => {
  const item = (url: string, key: string): PriceItem => ({ key, item: key, unit: 'GB', currency: 'USD', current: 1, sourceUrl: url });
  const items = ['a', 'a', 'b', 'c', 'd'].map((u, i) => item(`https://${u}.test/`, `k${i}`));
  const { kept, skipped } = capPages(items, 2);
  assert.deepEqual(kept.map((i) => i.key), ['k0', 'k1', 'k2']);
  assert.deepEqual(skipped.map((i) => i.key), ['k3', 'k4']);
});

test('functions reject wrong method, bad JSON, oversized and invalid bodies', async () => {
  assert.equal((await review(new Request('https://site.test/api/review'))).status, 405);
  assert.equal((await review(post('{not json'))).status, 400);
  assert.equal((await review(post('x'.repeat(60_000)))).status, 413);
  assert.equal((await review(post({ answers: {} }))).status, 400);
  assert.equal((await extract(post({ text: '  ' }))).status, 400);
});

test('without a key the functions answer "not configured" (no API call)', async () => {
  const answers = { ...DEFAULT_ANSWERS, projectType: 'ai_saas', features: DEFAULT_FEATURES.ai_saas };
  const advanced = { serviceOverrides: {}, priceOverrides: {}, instanceOverride: 0, disabledSlots: [], extraSlots: [] };
  const r = await checkPrices(post({ answers, workloadOverrides: {}, advanced, tier: 'recommended' }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).available, false);
  assert.equal((await (await extract(post({ text: 'An AI SaaS' }))).json()).available, false);
});

test('rate limits stay within Netlify limits (window ≤ 180 s)', () => {
  for (const c of [checkConfig, reviewConfig]) {
    assert.ok(c.rateLimit && c.rateLimit.windowSize <= 180 && c.rateLimit.windowLimit >= 1);
  }
  assert.equal(checkConfig.path, '/api/check-prices');
});
