import { AI_MODELS, CHECKED, USD_TO, byId, modelPrice, type AiModel, type CatalogEntry, type Meter, type ModelClass, type UsageKey } from './catalog';
import { PURPOSE, recommend, type Selection } from './recommend';
import type { Advanced, Answers, Estimate, Geo, Group, LineItem, ModelConfig, ServiceCost, Slot, Tier, Workload } from './types';
import { derive, type Derived } from './workload';

export const HOURS_PER_MONTH = 730;
export const today = () => new Date().toISOString().slice(0, 10);

export const GROUP_OF: Record<Slot, Group> = {
  frontend: 'Frontend hosting', backend: 'Backend hosting', loadbalancer: 'Backend hosting', database: 'Database', cache: 'Database',
  storage: 'Storage', ai: 'AI usage', auth: 'APIs', email: 'APIs', sms: 'APIs', payments: 'APIs', subscriptions: 'APIs', realtime: 'APIs',
  search: 'APIs', media: 'APIs', video: 'APIs', mcp: 'MCP infrastructure', monitoring: 'Monitoring', analytics: 'Other services',
  cicd: 'Other services', appstore: 'Other services', domain: 'Other services',
};

/** Cost of one meter before currency conversion. Handles free allowances and graduated / volume tiers. */
export function meterCost(m: Meter, qty: number, geo: Geo, overridePrice?: number): { cost: number; unitPrice: number; billable: number } {
  const per = m.per ?? 1;
  const included = m.included ?? 0;
  const billable = Math.max(0, qty - included);
  if (overridePrice !== undefined) return { cost: (billable / per) * overridePrice, unitPrice: overridePrice, billable };
  if (m.tiers) {
    if (m.tierMode === 'volume') {
      const rate = (m.tiers.find((t) => qty <= t.upTo) ?? m.tiers[m.tiers.length - 1]).price;
      return { cost: (billable / per) * rate, unitPrice: rate, billable };
    }
    let cost = 0;
    let lower = 0;
    for (const t of m.tiers) {
      const units = Math.max(0, Math.min(t.upTo, qty) - Math.max(lower, included));
      cost += (units / per) * t.price;
      lower = t.upTo;
    }
    return { cost, unitPrice: billable ? (cost / billable) * per : m.tiers[0].price, billable };
  }
  const price = m.byGeo?.[geo] ?? m.price;
  return { cost: (billable / per) * price, unitPrice: price, billable };
}

interface Ctx { a: Answers; d: Derived; instances: number; selectedIds: string[]; storageOnSupabase: boolean }

function usage(key: UsageKey, ctx: Ctx, entry: CatalogEntry): number {
  const { d, a, instances } = ctx;
  switch (key) {
    case 'instances': return instances;
    case 'instanceHours': return instances * HOURS_PER_MONTH;
    case 'vcpuHours': return instances * HOURS_PER_MONTH * (entry.instance?.vcpu ?? 1);
    case 'memGbHours': return instances * HOURS_PER_MONTH * (entry.instance?.memGb ?? 1);
    case 'albHours': return HOURS_PER_MONTH;
    case 'lcuHours': return HOURS_PER_MONTH * Math.max(0.5, d.avgRps / 25);
    case 'dbEgressGb': return d.dbEgressGb + (ctx.storageOnSupabase ? d.fileEgressGb : 0);
    case 'backgroundHours': return a.agent.backgroundHoursPerDay * 30;
    case 'ciMinutes': return 600;
    case 'seats': return 3;
    default: return d[key];
  }
}

function instanceCount(entry: CatalogEntry, sel: Selection, ctx: Ctx, adv: Advanced): number {
  if (entry.slot === 'mcp') return Math.max(1, ctx.a.agent.mcpServers) * Math.max(1, Math.ceil(ctx.a.agent.concurrentSessions / (entry.instance?.capacityRps ?? 50)));
  if (!entry.instance) return 1;
  if (entry.slot === 'backend' && adv.instanceOverride > 0) return adv.instanceOverride;
  return Math.max(sel.minInstances ?? 1, Math.ceil(ctx.d.peakRps / entry.instance.capacityRps));
}

const fmtQty = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
const fmtUsd = (n: number) => `$${n < 0.01 && n > 0 ? n.toPrecision(3) : n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;

function priceEntry(entry: CatalogEntry, sel: Selection, ctx: Ctx, adv: Advanced): ServiceCost {
  const instances = instanceCount(entry, sel, ctx, adv);
  const c = { ...ctx, instances };
  const toUsd = (n: number) => (entry.currency === 'INR' ? n / USD_TO.INR : n);
  const lines: LineItem[] = [];
  const notes = [...(entry.notes ?? [])];
  const period = entry.period ?? 'month';

  const baseShared = entry.sharedBaseWith?.some((id) => ctx.selectedIds.includes(id));
  const baseOverride = adv.priceOverrides[`${entry.id}:base`];
  const base = baseShared ? 0 : baseOverride ?? toUsd(entry.base);
  if (baseShared) notes.push('Plan fee already paid by another service on the same account.');
  if (entry.base > 0 || baseOverride !== undefined || entry.meters.length === 0) {
    lines.push({
      label: period === 'one-time' ? 'One-time fee' : period === 'year' ? 'Annual fee' : 'Plan fee',
      quantity: 1, unit: period === 'one-time' ? 'one-time' : period, unitPriceUsd: base, per: 1, included: 0,
      nativeCurrency: entry.currency ?? 'USD', nativeUnitPrice: entry.base, period,
      monthlyUsd: period === 'year' ? base / 12 : period === 'one-time' ? 0 : base, setupUsd: period === 'one-time' ? base : 0,
      status: baseOverride !== undefined ? 'user' : entry.status,
      formula: period === 'year' ? `${fmtUsd(base)} per year ÷ 12` : period === 'one-time' ? `${fmtUsd(base)} once (setup cost)` : `${fmtUsd(base)} fixed per month`,
    });
  }

  for (const m of entry.meters) {
    const qty = usage(m.key, c, entry);
    const override = adv.priceOverrides[`${entry.id}:${m.label}`];
    const r = meterCost(m, qty, ctx.a.geography, override === undefined ? undefined : entry.currency === 'INR' ? override * USD_TO.INR : override);
    const per = m.per ?? 1;
    const unitUsd = toUsd(r.unitPrice);
    const cost = toUsd(r.cost);
    lines.push({
      label: m.label, quantity: qty, unit: m.unit, unitPriceUsd: unitUsd, per, included: m.included ?? 0,
      nativeCurrency: entry.currency ?? 'USD', nativeUnitPrice: r.unitPrice, period: 'month', monthlyUsd: cost, setupUsd: 0,
      status: override !== undefined ? 'user' : m.status ?? entry.status,
      formula: `max(0, ${fmtQty(qty)} − ${fmtQty(m.included ?? 0)} included) ${per > 1 ? `÷ ${fmtQty(per)} ` : ''}× ${fmtUsd(unitUsd)}${m.tiers ? ' (tiered avg.)' : ''} = ${fmtUsd(cost)}`,
    });
    if (m.note) notes.push(m.note);
  }

  const metered = lines.filter((l) => l.unit !== 'month' && l.unit !== 'year' && l.unit !== 'one-time' && l.quantity > 0);
  return {
    slot: entry.slot, group: GROUP_OF[entry.slot], entryId: entry.id, provider: entry.provider, service: entry.service, plan: entry.plan,
    region: entry.region, purpose: PURPOSE[entry.slot], why: sel.why,
    usageSummary: metered.map((l) => `${fmtQty(l.quantity)} ${l.unit}`).join(' · ') || (entry.instance ? `${instances} instance(s)` : 'Flat fee'),
    sourceUrl: entry.sourceUrl, checked: entry.checked, lockIn: entry.lockIn, alternatives: entry.alternatives, notes, warnings: [],
    lines, monthlyUsd: lines.reduce((s, l) => s + l.monthlyUsd, 0), setupUsd: lines.reduce((s, l) => s + l.setupUsd, 0),
  };
}

function eligible(entry: CatalogEntry, ctx: Ctx, dbEntry?: CatalogEntry): boolean {
  if (entry.production === false && ctx.a.users !== 'testing') return false;
  if (entry.requiresDb && (dbEntry?.provider !== entry.requiresDb || (dbEntry.production === false) !== (entry.production === false))) return false;
  return Object.entries(entry.limits ?? {}).every(([k, limit]) => usage(k as UsageKey, { ...ctx, instances: 1 }, entry) <= limit!);
}

/** Choose the cheapest eligible plan in the family; fall back to the largest with a warning. */
function choose(sel: Selection, ctx: Ctx, adv: Advanced, dbEntry?: CatalogEntry): ServiceCost {
  const entries = sel.family.map(byId);
  const options = entries.filter((e) => eligible(e, ctx, dbEntry)).map((e) => priceEntry(e, sel, ctx, adv));
  if (options.length) return options.reduce((best, o) => (o.monthlyUsd < best.monthlyUsd ? o : best));
  const last = priceEntry(entries[entries.length - 1], sel, ctx, adv);
  last.warnings.push(`Your usage exceeds the limits of every ${last.provider} plan modeled here — contact ${last.provider} for higher tiers.`);
  return last;
}

// ---------- AI ----------

export function modelClass(a: Answers, tier: Tier): ModelClass {
  if (tier === 'budget') return 'economy';
  return a.aiUses.includes('agents') || a.priority === 'performance' || a.priority === 'enterprise' ? 'standard' : 'economy';
}

const perRequest = (m: AiModel, w: Workload, cached: boolean, asOf: string) => {
  const p = modelPrice(m, asOf);
  const c = cached ? w.aiCachedPct / 100 : 0;
  return (w.aiInputTokens * ((1 - c) * p.input + c * p.cachedInput) + w.aiOutputTokens * p.output) / 1e6;
};

export function resolveModel(cfg: ModelConfig, cls: ModelClass, w: Workload, asOf: string): AiModel | null {
  if (cfg.provider === 'other') return null;
  if (cfg.modelId) return AI_MODELS.find((m) => m.id === cfg.modelId) ?? null;
  const pool = AI_MODELS.filter((m) => m.cls === cls && (cfg.provider === 'auto' || m.provider === cfg.provider));
  return pool.reduce<AiModel | null>((best, m) => (!best || perRequest(m, w, cfg.caching, asOf) < perRequest(best, w, cfg.caching, asOf) ? m : best), null);
}

function aiServices(a: Answers, w: Workload, d: Derived, tier: Tier, why: string, adv: Advanced, asOf: string): ServiceCost[] {
  const totalShare = a.models.reduce((s, m) => s + m.sharePct, 0) || 1;
  const cls = modelClass(a, tier);
  return a.models.flatMap((cfg, i) => (cfg.sharePct > 0 ? [[cfg, i] as const] : [])).map(([cfg, i]) => {
    const model = resolveModel(cfg, cls, w, asOf);
    const requests = d.aiRequests * (cfg.sharePct / totalShare);
    const inTok = requests * w.aiInputTokens;
    const cachedTok = cfg.caching ? inTok * (w.aiCachedPct / 100) : 0;
    const outTok = requests * w.aiOutputTokens;
    const id = model?.id ?? `custom-${i}`;
    const p = model ? modelPrice(model, asOf) : { input: cfg.customInput ?? 0, cachedInput: cfg.customInput ?? 0, output: cfg.customOutput ?? 0 };
    const status = model ? 'verified' : cfg.customInput !== undefined && cfg.customOutput !== undefined ? 'user' : 'unavailable';
    const line = (label: string, tokens: number, key: 'input' | 'cachedInput' | 'output'): LineItem => {
      const override = adv.priceOverrides[`ai:${id}:${key}`];
      const price = override ?? p[key];
      const cost = (tokens / 1e6) * price;
      return {
        label, quantity: tokens, unit: 'tokens', unitPriceUsd: price, per: 1e6, included: 0, nativeCurrency: 'USD', nativeUnitPrice: price,
        period: 'month', monthlyUsd: cost, setupUsd: 0, status: override !== undefined ? 'user' : status,
        formula: `${fmtQty(tokens)} tokens ÷ 1,000,000 × ${fmtUsd(price)} = ${fmtUsd(cost)}`,
      };
    };
    const lines = [line('Input tokens', inTok - cachedTok, 'input'), ...(cachedTok ? [line('Cached input tokens', cachedTok, 'cachedInput')] : []), line('Output tokens', outTok, 'output')];
    const notes: string[] = [];
    if (model?.note) notes.push(model.note);
    const upcoming = model?.changes?.find((c) => c.from > asOf);
    if (upcoming) notes.push(`Published price change from ${upcoming.from}: $${upcoming.input} in / $${upcoming.output} out per 1M tokens.`);
    if (cfg.caching) notes.push(`Assumes ${w.aiCachedPct}% of input tokens are cache hits. Cache-write surcharges are not modeled.`);
    if (!model) notes.push(status === 'unavailable' ? 'Enter this model’s prices in Step 3 to include it.' : 'Prices entered by you.');
    return {
      slot: 'ai' as const, group: 'AI usage' as const, entryId: id, provider: model ? { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek' }[model.provider] : 'Other',
      service: model?.name ?? 'Custom model', plan: `Pay per token · ${Math.round((cfg.sharePct / totalShare) * 100)}% of AI traffic`, region: 'Global API',
      purpose: PURPOSE.ai, why: cfg.provider === 'auto' || !cfg.modelId ? `${why} Cheapest ${cls}-class model for your token mix.` : why,
      usageSummary: `${fmtQty(requests)} requests · ${fmtQty(inTok)} in / ${fmtQty(outTok)} out tokens`,
      sourceUrl: model?.sourceUrl ?? '', checked: model ? CHECKED : '', lockIn: 'low' as const,
      alternatives: AI_MODELS.filter((m) => m.cls === (model?.cls ?? cls) && m.id !== model?.id).slice(0, 3).map((m) => m.name),
      notes, warnings: [], lines, monthlyUsd: lines.reduce((s, l) => s + l.monthlyUsd, 0), setupUsd: 0,
    };
  });
}

// ---------- Estimate ----------

export function estimate(a: Answers, w: Workload, tier: Tier, adv: Advanced, asOf = today()): Estimate {
  const d = derive(w, a);
  const sels = recommend(a, d, tier, adv);
  const storageSel = sels.find((s) => s.slot === 'storage');
  // Filled with the plans actually chosen, in order, so shared base fees only count chosen plans.
  const ctx: Ctx = { a, d, instances: 1, selectedIds: [], storageOnSupabase: !!storageSel?.family[0].startsWith('supabase') };

  const dbSel = sels.find((s) => s.slot === 'database');
  const db = dbSel ? choose(dbSel, ctx, adv) : undefined;
  const dbEntry = db ? byId(db.entryId) : undefined;
  const services: ServiceCost[] = [];
  for (const s of sels) {
    if (s.slot === 'ai') services.push(...aiServices(a, w, d, tier, s.why, adv, asOf));
    else {
      const svc = s === dbSel ? db! : choose(s, ctx, adv, dbEntry);
      ctx.selectedIds.push(svc.entryId);
      services.push(svc);
    }
  }

  if (d.usesMcp && a.agent.tools > 0) {
    const mcp = services.find((s) => s.slot === 'mcp');
    const fee = a.agent.thirdPartyFeesUsd;
    mcp?.lines.push({
      label: 'Third-party tool subscriptions', quantity: 1, unit: 'month', unitPriceUsd: fee, per: 1, included: 0, nativeCurrency: 'USD',
      nativeUnitPrice: fee, period: 'month', monthlyUsd: fee, setupUsd: 0, status: fee > 0 ? 'user' : 'unavailable',
      formula: fee > 0 ? `${fmtUsd(fee)} entered by you` : 'Not entered — add paid tool/API subscriptions in Step 3',
    });
    if (mcp) mcp.monthlyUsd += fee;
  }

  const monthlyUsd = services.reduce((s, x) => s + x.monthlyUsd, 0);
  const byGroup: Partial<Record<Group, number>> = {};
  for (const s of services) byGroup[s.group] = (byGroup[s.group] ?? 0) + s.monthlyUsd;
  return {
    tier, services, monthlyUsd, annualUsd: monthlyUsd * 12, setupUsd: services.reduce((s, x) => s + x.setupUsd, 0),
    perMauUsd: monthlyUsd / Math.max(1, d.mau), byGroup, warnings: services.flatMap((s) => s.warnings),
  };
}

export const convert = (usd: number, ccy: keyof typeof USD_TO) => usd * USD_TO[ccy];
