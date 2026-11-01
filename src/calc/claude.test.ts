import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priceItems } from '../../claude';
import { estimate } from './engine';
import { DEFAULT_ANSWERS, DEFAULT_FEATURES } from './questionnaire';
import type { Advanced, Answers } from './types';
import { defaultWorkload } from './workload';

const ADV: Advanced = { serviceOverrides: {}, priceOverrides: {}, instanceOverride: 0, disabledSlots: [], extraSlots: [] };
const a: Answers = { ...DEFAULT_ANSWERS, projectType: 'ai_saas', features: DEFAULT_FEATURES.ai_saas, aiUses: ['chatbot'] };

test('every live-price-check key is a price-override key the engine applies', () => {
  const w = defaultWorkload(a);
  const items = priceItems(a, w, ADV, 'recommended');
  assert.ok(items.length > 0);
  for (const item of items) {
    // A small price change (+1%) keeps plan selection stable, so this only tests the key wiring.
    const usd = item.current * 1.01;
    const e = estimate(a, w, 'recommended', { ...ADV, priceOverrides: { [item.key]: usd } }, '2026-11-01');
    const hit = e.services.flatMap((s) => s.lines).some((l) => l.status === 'user' && Math.abs(l.unitPriceUsd - usd) < 1e-9);
    assert.ok(hit, `override key not applied: ${item.key}`);
  }
});
