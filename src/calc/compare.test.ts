import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SB_NEON_SCENARIOS, compareRow } from './compare';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} ≈ ${b}`);

// The /guides/supabase-vs-neon-pricing/ prose quotes these totals. If a catalogue price changes, this fails:
// update the page text and its dateModified together with the catalogue.
test('Supabase vs Neon scenario totals', () => {
  const expected = [[25, 3.32], [25, 21.095], [36, 45.69], [293.5, 128.38]];
  SB_NEON_SCENARIOS.forEach((s, i) => {
    const r = compareRow(s);
    close(r.supabase.totalUsd, expected[i][0]);
    close(r.neon.totalUsd, expected[i][1]);
  });
});

test('both free tiers fit the side project only', () => {
  assert.deepEqual(SB_NEON_SCENARIOS.map((s) => compareRow(s).supabaseFreeFits), [true, false, false, false]);
  assert.deepEqual(SB_NEON_SCENARIOS.map((s) => compareRow(s).neonFreeFits), [true, false, false, false]);
});

test('Neon includes auth up to 1M MAU on Launch; Supabase bills MAU above 100k', () => {
  const scale = compareRow(SB_NEON_SCENARIOS[3]);
  close(scale.supabase.lines.find((l) => l.label.includes('Monthly active users'))!.costUsd, 162.5);
  assert.equal(scale.neon.lines.some((l) => /auth/i.test(l.label) && l.costUsd > 0), false);
});
