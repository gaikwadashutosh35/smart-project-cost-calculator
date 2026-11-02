import { byId, type UsageKey } from './catalog.ts';
import { meterCost } from './engine.ts';

/** Supabase-only bill for the /supabase-pricing-calculator/ page, priced from the same catalogue entries as the main engine. */

export const COMPUTE = {
  micro: { entry: 'supabase-pro', label: 'Micro', price: 10, ram: '1 GB', cpu: 'Shared', connections: '60 direct / 200 pooler' },
  small: { entry: 'supabase-pro-small', label: 'Small', price: 15, ram: '2 GB', cpu: 'Shared', connections: '90 / 400' },
  medium: { entry: 'supabase-pro-medium', label: 'Medium', price: 60, ram: '4 GB', cpu: 'Shared', connections: '120 / 600' },
  large: { entry: 'supabase-pro-large', label: 'Large', price: 110, ram: '8 GB', cpu: '2 dedicated vCPU', connections: '160 / 800' },
} as const;

export interface SupabaseUsage {
  plan: 'free' | 'pro';
  compute: keyof typeof COMPUTE;
  dbGb: number;
  egressGb: number;
  mau: number;
  storageGb: number;
  realtimePeak: number;
  realtimeMessages: number;
  edgeInvocations: number;
}

export interface BillLine { label: string; quantity: number; unit: string; included: number; unitPrice: number; per: number; costUsd: number }

const usageKey: Partial<Record<UsageKey, keyof SupabaseUsage>> = {
  dbStorageGb: 'dbGb', dbEgressGb: 'egressGb', mau: 'mau', fileStorageGb: 'storageGb',
  realtimeConnections: 'realtimePeak', realtimeMessages: 'realtimeMessages', requests: 'edgeInvocations',
};

const LIMIT_LABEL: Partial<Record<UsageKey, string>> = {
  dbStorageGb: 'database size', dbEgressGb: 'egress', mau: 'monthly active users', fileStorageGb: 'file storage',
  realtimeConnections: 'realtime peak connections', realtimeMessages: 'realtime messages', requests: 'Edge Function invocations',
};

const PRO_ENTRIES = ['supabase-auth-pro', 'supabase-storage-pro', 'supabase-realtime-pro', 'supabase-edge-pro'];
const FREE_ENTRIES = ['supabase-free', 'supabase-auth-free', 'supabase-storage-free', 'supabase-realtime-free', 'supabase-edge-free'];

export function supabaseBill(u: SupabaseUsage): { lines: BillLine[]; totalUsd: number; freeIssues: string[] } {
  const qty = (k: UsageKey) => Number(u[usageKey[k]!] ?? 0);

  if (u.plan === 'free') {
    const freeIssues = FREE_ENTRIES.flatMap((id) =>
      Object.entries(byId(id).limits ?? {})
        .filter(([k, limit]) => k in usageKey && qty(k as UsageKey) > limit!)
        .map(([k, limit]) => `${LIMIT_LABEL[k as UsageKey]}: ${qty(k as UsageKey).toLocaleString('en-US')} is over the Free limit of ${limit!.toLocaleString('en-US')}`),
    );
    return { lines: [], totalUsd: 0, freeIssues };
  }

  const db = byId(COMPUTE[u.compute].entry);
  const lines: BillLine[] = [
    { label: `Pro plan + ${COMPUTE[u.compute].label} compute (net of $10 compute credit)`, quantity: 1, unit: 'month', included: 0, unitPrice: db.base, per: 1, costUsd: db.base },
  ];
  for (const e of [db, ...PRO_ENTRIES.map(byId)]) {
    for (const m of e.meters) {
      const q = qty(m.key);
      const r = meterCost(m, q, 'usa');
      lines.push({ label: `${e.service === 'PostgreSQL' ? '' : `${e.service}: `}${m.label}`, quantity: q, unit: m.unit, included: m.included ?? 0, unitPrice: r.unitPrice, per: m.per ?? 1, costUsd: r.cost });
    }
  }
  return { lines, totalUsd: lines.reduce((s, l) => s + l.costUsd, 0), freeIssues: [] };
}
