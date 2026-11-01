import { ArrowLeft, RotateCcw } from 'lucide-react';
import { CATALOG, USD_TO } from '../calc/catalog';
import { money } from '../calc/export';
import { PURPOSE, TIER_INFO } from '../calc/recommend';
import type { Advanced as Adv, Answers, Estimate, Slot, Workload } from '../calc/types';
import { AgentEditor, ModelsEditor } from './Wizard';
import { Card, NumberField, Select, StatusBadge, btn } from './kit';

interface Props {
  a: Answers; set: (p: Partial<Answers>) => void; w: Workload; setW: (p: Partial<Workload>) => void; resetW: () => void;
  adv: Adv; setAdv: (p: Partial<Adv>) => void; e: Estimate; onBack: () => void;
}

export const WORKLOAD_FIELDS: [keyof Workload, string, string?][] = [
  ['registeredUsers', 'Registered users'], ['activePct', 'Active each month', '%'], ['sessionsPerMau', 'Sessions / active user', '/mo'],
  ['requestsPerSession', 'API requests / session'], ['pageViewsPerSession', 'Page views / session'], ['dbOpsPerRequest', 'DB ops / request'],
  ['kbPerResponse', 'API response size', 'KB'], ['mbPerPageView', 'Page weight', 'MB'], ['fileStorageBaseGb', 'Base file storage', 'GB'],
  ['fileStorageMbPerUser', 'File storage / user', 'MB'], ['fileMbPerPageView', 'File downloads / page view', 'MB'], ['dbStorageMbPerUser', 'DB storage / user', 'MB'],
  ['peakMultiplier', 'Peak multiplier', '×'], ['emailsPerMau', 'Emails / active user', '/mo'], ['smsPerMau', 'SMS / active user', '/mo'],
  ['searchesPerSession', 'Searches / session'], ['eventsPerSession', 'Analytics events / session'], ['errorRatePct', 'Error rate', '%'],
  ['realtimeMsgsPerDau', 'Realtime msgs / daily user'], ['aiRequestsPerMau', 'AI requests / active user', '/mo'], ['aiInputTokens', 'AI input tokens / request'],
  ['aiOutputTokens', 'AI output tokens / request'], ['aiCachedPct', 'Cacheable input tokens', '%'],
];

const OVERRIDABLE: Slot[] = ['frontend', 'backend', 'database', 'cache', 'storage', 'auth', 'email', 'sms', 'payments', 'realtime', 'search', 'media', 'analytics', 'monitoring', 'mcp', 'cicd'];

export function AdvancedMode({ a, set, w, setW, resetW, adv, setAdv, e, onBack }: Props) {
  const rate = USD_TO[a.currency];
  const present = new Set(e.services.map((s) => s.slot));
  const setOverride = (slot: Slot, id: string) => {
    const next = { ...adv.serviceOverrides };
    if (id) next[slot] = id; else delete next[slot];
    setAdv({ serviceOverrides: next });
  };
  const setPrice = (key: string, usd: number | null) => {
    const next = { ...adv.priceOverrides };
    if (usd === null) delete next[key]; else next[key] = usd;
    setAdv({ priceOverrides: next });
  };
  const toggleList = <K extends 'disabledSlots' | 'extraSlots'>(k: K, v: Adv[K][number]) =>
    setAdv({ [k]: (adv[k] as string[]).includes(v) ? (adv[k] as string[]).filter((x) => x !== v) : [...adv[k], v] } as Partial<Adv>);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={btn.ghost} onClick={onBack}><ArrowLeft size={16} /> Back to results</button>
        <Card className="px-4 py-2.5 sticky top-20 z-10">
          <span className="text-xs text-muted">{TIER_INFO[e.tier].title} · live total</span>
          <span className="block text-xl font-bold tabular-nums">{money(e.monthlyUsd, a.currency)}/mo</span>
        </Card>
      </div>
      <div>
        <h2 className="text-[28px] sm:text-[32px] leading-tight font-bold tracking-[-0.256px]">Customize technical configuration</h2>
        <p className="text-muted text-sm mt-1">Every change here feeds the same calculation engine. Leave anything alone to keep the automatic choice.</p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Workload</h3><button type="button" className={btn.ghost} onClick={resetW}><RotateCcw size={14} /> Reset</button></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {WORKLOAD_FIELDS.map(([k, label, suffix]) => <NumberField key={k} label={label} suffix={suffix} step={k === 'peakMultiplier' || k === 'mbPerPageView' ? 0.1 : 1} value={w[k]} onChange={(v) => setW({ [k]: v })} />)}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold mb-1">Providers and plans</h3>
        <p className="text-xs text-muted mb-3">Choosing a specific plan applies it to all three architectures. Cloud: AWS, Azure, Google Cloud, Fly.io, Cloudflare, Vercel, Render. Databases: PostgreSQL (Supabase, Neon, RDS, Cloud SQL, Azure), MongoDB Atlas, DynamoDB, Redis.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {OVERRIDABLE.map((slot) => {
            const options = CATALOG.filter((c) => c.slot === slot);
            if (!options.length) return null;
            const isExtra = slot === 'cache' || slot === 'cicd';
            return (
              <div key={slot} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium capitalize">{slot}</span>
                  {isExtra ? (
                    <label className="text-xs flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={adv.extraSlots.includes(slot as 'cache' | 'cicd')} onChange={() => toggleList('extraSlots', slot as 'cache' | 'cicd')} /> Always include</label>
                  ) : (
                    <label className="text-xs flex items-center gap-1.5"><input type="checkbox" className="accent-primary" checked={adv.disabledSlots.includes(slot)} onChange={() => toggleList('disabledSlots', slot)} /> Exclude</label>
                  )}
                </div>
                <Select label={PURPOSE[slot]} value={adv.serviceOverrides[slot] ?? ''} onChange={(v) => setOverride(slot, v)}
                  options={[{ value: '', label: present.has(slot) ? 'Automatic (recommended)' : 'Automatic (not needed for your answers)' }, ...options.map((o) => ({ value: o.id, label: `${o.provider} ${o.service} — ${o.plan}` }))]} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 max-w-xs">
          <NumberField label="Backend instances (0 = automatic)" value={adv.instanceOverride} onChange={(v) => setAdv({ instanceOverride: Math.round(v) })} hint="Overrides the instance count for server-based backends (Render, Fly.io, EC2, Fargate, App Service)." />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold mb-3">AI models and routing</h3>
        {a.aiUses.length ? <ModelsEditor a={a} set={set} /> : <p className="text-sm text-muted">AI is off. Turn it on in step 3 of the questionnaire.</p>}
      </Card>

      {(a.aiUses.includes('agents') || a.aiUses.includes('automation') || a.features.includes('mcp')) && (
        <Card className="p-4 sm:p-5"><h3 className="font-semibold mb-3">MCP servers and agent tools</h3><AgentEditor a={a} set={set} /></Card>
      )}

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold mb-1">Manual price overrides</h3>
        <p className="text-xs text-muted mb-3">Have a negotiated rate or a newer price? Enter the unit price in {a.currency}; it replaces the catalogue price (free allowances still apply).</p>
        <div className="space-y-4">
          {e.services.map((s, si) => (
            <div key={s.entryId + si}>
              <p className="text-sm font-medium">{s.provider} · {s.service} <span className="text-muted font-normal">({s.plan})</span></p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1.5">
                {s.lines.filter((l) => l.label !== 'Third-party tool subscriptions').map((l) => {
                  const key = s.slot === 'ai'
                    ? `ai:${s.entryId}:${l.label.startsWith('Cached') ? 'cachedInput' : l.label.startsWith('Input') ? 'input' : 'output'}`
                    : `${s.entryId}:${l.unit === 'month' || l.unit === 'year' || l.unit === 'one-time' ? 'base' : l.label}`;
                  const overridden = adv.priceOverrides[key] !== undefined;
                  return (
                    <div key={key} className="flex items-end gap-2">
                      <div className="flex-1">
                        <NumberField label={`${l.label} (per ${l.per > 1 ? l.per.toLocaleString('en-US') + ' ' : ''}${l.unit})`} step={0.0001}
                          value={l.unitPriceUsd * rate} onChange={(v) => setPrice(key, v / rate)} />
                      </div>
                      <span className="pb-2 flex items-center gap-1">
                        <StatusBadge status={l.status} />
                        {overridden && <button type="button" aria-label="Clear override" className={btn.ghost} onClick={() => setPrice(key, null)}><RotateCcw size={14} /></button>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
