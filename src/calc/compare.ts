import { byId } from './catalog.ts';
import { meterCost } from './engine.ts';
import { COMPUTE, supabaseBill, type BillLine } from './supabase.ts';

/** Scenarios for /guides/supabase-vs-neon-pricing/. Compute is matched by memory: Micro 1 GB ↔ 0.25 CU, Small 2 GB ↔ 0.5 CU, Medium 4 GB ↔ 1 CU. */
export interface CompareScenario {
  name: string;
  mau: number;
  dbGb: number;
  egressGb: number;
  supabaseCompute: keyof typeof COMPUTE;
  neonCu: number;
  neonHours: number; // hours the Neon compute is awake in a month (730 = always on)
}

export const SB_NEON_SCENARIOS: CompareScenario[] = [
  { name: 'Side project', mau: 1_000, dbGb: 0.4, egressGb: 3, supabaseCompute: 'micro', neonCu: 0.25, neonHours: 120 },
  { name: 'Startup', mau: 10_000, dbGb: 5, egressGb: 60, supabaseCompute: 'micro', neonCu: 0.25, neonHours: 730 },
  { name: 'Growing app', mau: 50_000, dbGb: 20, egressGb: 300, supabaseCompute: 'small', neonCu: 0.5, neonHours: 730 },
  { name: 'Scale', mau: 150_000, dbGb: 60, egressGb: 800, supabaseCompute: 'medium', neonCu: 1, neonHours: 730 },
];

export function compareRow(s: CompareScenario) {
  const usage = { compute: s.supabaseCompute, dbGb: s.dbGb, egressGb: s.egressGb, mau: s.mau, storageGb: 0, realtimePeak: 0, realtimeMessages: 0, edgeInvocations: 0 };
  const supabase = supabaseBill({ ...usage, plan: 'pro' });
  const supabaseFreeFits = supabaseBill({ ...usage, plan: 'free' }).freeIssues.length === 0;

  const launch = byId('neon-launch');
  const cuHours = s.neonCu * s.neonHours;
  const q = { cuHours, dbStorageGb: s.dbGb, dbEgressGb: s.egressGb } as Record<string, number>;
  const neonLines: BillLine[] = launch.meters.map((m) => ({
    label: m.label, quantity: q[m.key], unit: m.unit, included: m.included ?? 0, unitPrice: m.price, per: m.per ?? 1, costUsd: meterCost(m, q[m.key], 'usa').cost,
  }));
  const auth = byId('neon-auth-launch');
  neonLines.push({ label: `${auth.service} (included up to ${auth.limits!.mau!.toLocaleString('en-US')} MAU)`, quantity: s.mau, unit: 'MAU', included: auth.limits!.mau!, unitPrice: 0, per: 1, costUsd: 0 });

  const free = byId('neon-free').limits!;
  const neonFreeFits = s.dbGb <= free.dbStorageGb! && cuHours <= free.cuHours! && s.egressGb <= free.dbEgressGb! && s.mau <= byId('neon-auth-free').limits!.mau!;

  return {
    cuHours,
    supabase,
    supabaseFreeFits,
    neon: { lines: neonLines, totalUsd: neonLines.reduce((t, l) => t + l.costUsd, 0) },
    neonFreeFits,
  };
}
