import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supabaseBill, type SupabaseUsage } from './supabase';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const base: SupabaseUsage = { plan: 'pro', compute: 'micro', dbGb: 2, egressGb: 50, mau: 5000, storageGb: 10, realtimePeak: 100, realtimeMessages: 1e6, edgeInvocations: 500_000 };

test('Pro within quotas costs the $25 base only', () => {
  const b = supabaseBill(base);
  close(b.totalUsd, 25);
  assert.deepEqual(b.freeIssues, []);
});

test('Pro overages are billed per quota', () => {
  const b = supabaseBill({ ...base, dbGb: 18, egressGb: 350, mau: 150_000, storageGb: 150 });
  close(b.totalUsd, 25 + 10 * 0.125 + 100 * 0.09 + 50_000 * 0.00325 + 50 * 0.0213);
});

test('compute add-ons are billed net of the $10 Pro credit', () => {
  close(supabaseBill({ ...base, compute: 'small' }).totalUsd, 30);
  close(supabaseBill({ ...base, compute: 'large' }).totalUsd, 125);
});

test('Free plan costs nothing but lists every limit exceeded', () => {
  const ok = supabaseBill({ ...base, plan: 'free', dbGb: 0.3, egressGb: 3, storageGb: 0.5 });
  close(ok.totalUsd, 0);
  assert.deepEqual(ok.freeIssues, []);
  const over = supabaseBill({ ...base, plan: 'free', dbGb: 2, mau: 60_000 });
  assert.equal(over.freeIssues.length, 4); // database size, egress, MAU, file storage
  assert.ok(over.freeIssues.some((i) => i.includes('database')));
});
