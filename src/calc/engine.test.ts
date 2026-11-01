import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AI_MODELS, USD_TO, byId, modelPrice } from './catalog';
import { HOURS_PER_MONTH, meterCost } from './engine';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('usage beyond the included allowance is billed', () => {
  close(meterCost({ key: 'apiEgressGb', label: '', unit: 'GB', price: 0.09, included: 100 }, 120, 'usa').cost, 20 * 0.09);
  close(meterCost({ key: 'apiEgressGb', label: '', unit: 'GB', price: 0.09, included: 100 }, 80, 'usa').cost, 0);
});

test('per-unit scaling (per 1M requests)', () => {
  const workers = byId('cf-workers-paid').meters[0];
  close(meterCost(workers, 15e6, 'usa').cost, 5 * 0.3);
});

test('graduated tiers (Clerk MRU)', () => {
  const m = byId('clerk-pro').meters[0];
  // 50k included; 50k at $0.02; 50k at $0.018
  close(meterCost(m, 150_000, 'usa').cost, 50_000 * 0.02 + 50_000 * 0.018);
});

test('volume tiers price the whole quantity at one rate (MSG91, INR)', () => {
  const m = byId('msg91').meters[0];
  close(meterCost(m, 20_000, 'india').cost, 20_000 * 0.22);
});

test('geography-specific prices (Fly.io egress to India)', () => {
  const m = byId('fly-shared-1gb').meters[1];
  close(meterCost(m, 100, 'india').cost, 12);
  close(meterCost(m, 100, 'usa').cost, 2);
});

test('manual price override replaces the catalogue price', () => {
  close(meterCost({ key: 'emails', label: '', unit: 'emails', price: 0.1, per: 1000 }, 10_000, 'usa', 0.5).cost, 5);
});

test('compute formula: hourly price × hours × instances', () => {
  const m = byId('aws-ec2-t4g-small').meters[0];
  close(meterCost(m, 2 * HOURS_PER_MONTH, 'usa').cost, 0.0168 * 730 * 2);
});

test('AI token formula and scheduled price changes', () => {
  const argon = AI_MODELS.find((m) => m.id === 'gemini-4-argon')!;
  assert.equal(modelPrice(argon, '2026-11-15').input, 2);
  assert.equal(modelPrice(argon, '2026-12-01').input, 4);
  const haiku = AI_MODELS.find((m) => m.id === 'claude-haiku-5-5')!;
  close((3_000_000 / 1e6) * modelPrice(haiku, '2026-11-01').input, 0.3);
});

test('currency conversion uses ECB-derived rates', () => {
  close(USD_TO.USD, 1);
  close(USD_TO.INR, 106.084 / 1.1172);
  close(USD_TO.EUR * 1.1172, 1);
});
