import { useState, type ReactNode } from 'react';
import {
  Bot, Globe, LayoutDashboard, Loader2, Plus, Puzzle, Server, ShoppingCart, Smartphone, Sparkles, Store, Trash2, Users, Wand2,
} from 'lucide-react';
import { AI_MODELS, USD_TO } from '../calc/catalog';
import { money } from '../calc/export';
import {
  AI_LEVEL_INFO, AI_USE_INFO, BUDGET_INFO, DEFAULT_FEATURES, FEATURE_INFO, FREQUENCY_INFO, GEO_INFO, GROWTH_INFO, PRIORITY_INFO,
  PROJECT_INFO, PROVIDER_INFO, USER_INFO, aiUsesFromFeatures, extractLocally, visibleFeatures, type Extraction,
} from '../calc/questionnaire';
import { AI_USES, CURRENCIES, type AiUse, type Answers, type Estimate, type Feature, type ModelConfig, type ProjectType, type Workload } from '../calc/types';
import { WORKLOAD_EXPLANATION, type Derived } from '../calc/workload';
import { Card, ChoiceCard, Chip, NumberField, Select, StepHeading, SubHeading, btn, cx } from './kit';

type Set = (patch: Partial<Answers>) => void;
const keys = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as T[];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const PROJECT_ICON: Record<ProjectType, ReactNode> = {
  ai_saas: <Sparkles size={20} />, ai_agent: <Bot size={20} />, ecommerce: <ShoppingCart size={20} />, website: <Globe size={20} />,
  mobile: <Smartphone size={20} />, social: <Users size={20} />, marketplace: <Store size={20} />, dashboard: <LayoutDashboard size={20} />,
  api: <Server size={20} />, custom: <Puzzle size={20} />,
};

export const STEPS = ['Project', 'Users', 'AI', 'Budget'];

export function Progress({ step, onJump, canJump }: { step: number; onJump: (s: number) => void; canJump: boolean }) {
  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => onJump(i)}
              aria-current={i === step ? 'step' : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={cx('block h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-line')} />
              <span className={cx('block text-xs mt-1.5', i === step ? 'text-ink font-semibold' : 'text-muted')}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------- Step 1 ----------

const syncAi = (features: Feature[], type: ProjectType | null, current: AiUse[]): AiUse[] => {
  const implied = aiUsesFromFeatures(features, type);
  const kept = current.filter((u) => (u === 'chatbot' ? features.includes('ai_chatbot') : u === 'agents' ? features.includes('ai_agents') || type === 'ai_agent' : true));
  return [...new Set([...kept, ...implied])];
};

export function StepProject({ a, set }: { a: Answers; set: Set }) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<Extraction | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const pickType = (t: ProjectType) => set({ projectType: t, features: DEFAULT_FEATURES[t], aiUses: aiUsesFromFeatures(DEFAULT_FEATURES[t], t) });
  const toggle = (f: Feature) => {
    const features = a.features.includes(f) ? a.features.filter((x) => x !== f) : [...a.features, f];
    set({ features, aiUses: syncAi(features, a.projectType, a.aiUses) });
  };

  async function analyze() {
    setBusy(true);
    setFallbackNote(null);
    try {
      const r = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: a.description }) });
      const data = await r.json();
      if (data.result) setSuggestion({ ...data.result, source: 'claude' });
      else {
        setSuggestion(extractLocally(a.description));
        setFallbackNote(data.error ?? 'Claude is unavailable.');
      }
    } catch {
      setSuggestion(extractLocally(a.description));
      setFallbackNote('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    const s = suggestion;
    const type = s.projectType ?? a.projectType;
    const features = [...new Set([...a.features, ...s.features])].filter((f) => visibleFeatures(type).includes(f));
    set({
      projectType: type,
      features,
      aiUses: s.aiUses?.length ? [...new Set([...syncAi(features, type, a.aiUses), ...s.aiUses])] : syncAi(features, type, a.aiUses),
      ...(s.users && { users: s.users }),
      ...(s.frequency && { frequency: s.frequency }),
      ...(s.geography && { geography: s.geography }),
      ...(s.provider && { provider: s.provider }),
    });
    setSuggestion(null);
  }
  const suggestedRows = suggestion ? ([
    ['Project type', suggestion.projectType && PROJECT_INFO[suggestion.projectType].title],
    ['Features', suggestion.features.map((f) => FEATURE_INFO[f]).join(', ')],
    ['Users', suggestion.users && USER_INFO[suggestion.users]],
    ['Usage', suggestion.frequency && FREQUENCY_INFO[suggestion.frequency].title],
    ['Where', suggestion.geography && GEO_INFO[suggestion.geography]],
    ['AI', suggestion.aiUses?.map((u) => AI_USE_INFO[u]).join(', ')],
    ['Cloud preference', suggestion.provider && suggestion.provider !== 'none' && PROVIDER_INFO[suggestion.provider]],
  ] as const).filter(([, v]) => v) : [];

  return (
    <>
      <StepHeading title="What are you planning to build?" sub="Pick the closest match — you can fine-tune features below." />
      <div role="radiogroup" aria-label="Project type" className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {keys(PROJECT_INFO).map((t) => (
          <ChoiceCard key={t} selected={a.projectType === t} onClick={() => pickType(t)} icon={PROJECT_ICON[t]} title={PROJECT_INFO[t].title} desc={PROJECT_INFO[t].desc} />
        ))}
      </div>

      <SubHeading>What features do you need?</SubHeading>
      {!a.projectType && <p className="text-sm text-muted mb-2">Choose a project type first to see suggested features.</p>}
      <div role="group" aria-label="Features" className="flex flex-wrap gap-2">
        {visibleFeatures(a.projectType).map((f) => (
          <Chip key={f} selected={a.features.includes(f)} onClick={() => toggle(f)}>{FEATURE_INFO[f]}</Chip>
        ))}
      </div>

      <SubHeading>Describe your project in your own words <span className="font-normal text-muted">(optional)</span></SubHeading>
      <textarea
        aria-label="Project description"
        value={a.description}
        maxLength={2000}
        onChange={(e) => set({ description: e.target.value })}
        rows={3}
        placeholder="I want to create an AI-powered SaaS application with user subscriptions, chatbot, payment gateway, and admin dashboard."
        className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-primary"
      />
      <button type="button" className={cx(btn.secondary, 'mt-2')} disabled={!a.description.trim() || busy} onClick={analyze}>
        {busy ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <Wand2 size={16} />} {busy ? 'Claude is reading your description…' : 'Suggest answers from description'}
      </button>

      {suggestion && (
        <Card className="mt-3 p-4 border-primary/40">
          <p className="text-sm font-semibold">
            Suggested from your description{' '}
            <span className="font-normal text-muted">({suggestion.source === 'claude' ? 'by Claude' : 'keyword match'})</span>
          </p>
          {fallbackNote && <p className="text-xs text-amber-800 mt-1">{fallbackNote} Using keyword matching instead.</p>}
          {suggestedRows.length ? (
            <dl className="text-sm mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              {suggestedRows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
          ) : <p className="text-sm text-muted mt-1">Nothing recognisable found — please pick options manually.</p>}
          {suggestion.notes && <p className="text-xs text-muted mt-2">{suggestion.notes}</p>}
          <div className="flex gap-2 mt-3">
            {suggestedRows.length > 0 && <button type="button" className={btn.primary} onClick={apply}>Apply suggestions</button>}
            <button type="button" className={btn.secondary} onClick={() => setSuggestion(null)}>Dismiss</button>
          </div>
        </Card>
      )}
    </>
  );
}

// ---------- Step 2 ----------

export function StepUsers({ a, set, w, d, setW, resetW }: { a: Answers; set: Set; w: Workload; d: Derived; setW: (p: Partial<Workload>) => void; resetW: () => void }) {
  return (
    <>
      <StepHeading title="How many people will use it?" sub="Rough guesses are fine — you can edit the numbers below." />
      <SubHeading>Expected registered users</SubHeading>
      <div role="radiogroup" aria-label="Expected users" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {keys(USER_INFO).map((u) => <ChoiceCard key={u} selected={a.users === u} onClick={() => { set({ users: u }); resetW(); }} title={USER_INFO[u]} />)}
      </div>
      <SubHeading>How often will they use it?</SubHeading>
      <div role="radiogroup" aria-label="Usage frequency" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {keys(FREQUENCY_INFO).map((f) => <ChoiceCard key={f} selected={a.frequency === f} onClick={() => { set({ frequency: f }); resetW(); }} title={FREQUENCY_INFO[f].title} desc={FREQUENCY_INFO[f].desc} />)}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6">
        <div>
          <SubHeading>Where are your users?</SubHeading>
          <div className="flex flex-wrap gap-2">{keys(GEO_INFO).map((g) => <Chip key={g} selected={a.geography === g} onClick={() => { set({ geography: g }); resetW(); }}>{GEO_INFO[g]}</Chip>)}</div>
        </div>
        <div>
          <SubHeading>Expected growth</SubHeading>
          <div className="flex flex-wrap gap-2">{keys(GROWTH_INFO).map((g) => <Chip key={g} selected={a.growth === g} onClick={() => set({ growth: g })}>{GROWTH_INFO[g].title}</Chip>)}</div>
        </div>
      </div>

      <Card className="mt-8 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold">Workload assumptions</h3>
          <button type="button" className={btn.ghost} onClick={resetW}>Reset to defaults</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberField label="Registered users" value={w.registeredUsers} onChange={(v) => setW({ registeredUsers: v })} />
          <NumberField label="Active each month" value={w.activePct} onChange={(v) => setW({ activePct: Math.min(100, v) })} suffix="%" hint="Share of registered users who use the product in a given month (MAU)." />
          <NumberField label="Sessions per active user" value={w.sessionsPerMau} onChange={(v) => setW({ sessionsPerMau: v })} suffix="/mo" />
          <NumberField label="API requests per session" value={w.requestsPerSession} onChange={(v) => setW({ requestsPerSession: v })} />
          <NumberField label="DB operations per request" value={w.dbOpsPerRequest} onChange={(v) => setW({ dbOpsPerRequest: v })} />
          <NumberField label="File storage per user" value={w.fileStorageMbPerUser} onChange={(v) => setW({ fileStorageMbPerUser: v })} suffix="MB" />
          <NumberField label="Page weight" value={w.mbPerPageView} step={0.1} onChange={(v) => setW({ mbPerPageView: v })} suffix="MB/view" hint="Data transferred per page view after browser caching." />
          <NumberField label="Peak traffic multiplier" value={w.peakMultiplier} step={0.5} onChange={(v) => setW({ peakMultiplier: Math.max(1, v) })} suffix="×" hint="How much busier the busiest hour is than average." />
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 text-sm">
          {[
            ['Monthly active users', fmt(d.mau)],
            ['API requests / month', fmt(d.requests)],
            ['DB operations / month', fmt(d.dbOps)],
            ['Storage (DB + files)', `${(d.dbStorageGb + d.fileStorageGb).toFixed(1)} GB`],
            ['Bandwidth / month', `${(d.frontendEgressGb + d.apiEgressGb + d.fileEgressGb).toFixed(1)} GB`],
            ['Peak requests / second', d.peakRps.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-canvas p-2.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-primary font-medium">How these estimates are calculated</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">{WORKLOAD_EXPLANATION.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      </Card>
    </>
  );
}

// ---------- Step 3 ----------

const PROVIDER_LABEL: Record<ModelConfig['provider'], string> = {
  auto: 'Recommend the most economical', openai: 'OpenAI', anthropic: 'Claude (Anthropic)', google: 'Gemini (Google)', deepseek: 'DeepSeek', other: 'Other (enter prices)',
};

export function ModelsEditor({ a, set }: { a: Answers; set: Set }) {
  const update = (i: number, p: Partial<ModelConfig>) => set({ models: a.models.map((m, j) => (j === i ? { ...m, ...p } : m)) });
  const totalShare = a.models.reduce((s, m) => s + m.sharePct, 0);
  return (
    <div className="space-y-3">
      {a.models.map((m, i) => (
        <Card key={i} className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1.3fr_0.7fr_auto] gap-3 items-end">
            <Select label="Provider" value={m.provider} onChange={(v) => update(i, { provider: v, modelId: '' })}
              options={keys(PROVIDER_LABEL).map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))} />
            {m.provider !== 'auto' && m.provider !== 'other' ? (
              <Select label="Model" value={m.modelId} onChange={(v) => update(i, { modelId: v })}
                options={[{ value: '', label: 'Cheapest suitable model' }, ...AI_MODELS.filter((x) => x.provider === m.provider).map((x) => ({ value: x.id, label: `${x.name} ($${x.input} / $${x.output} per 1M)` }))]} />
            ) : m.provider === 'other' ? (
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Input $/1M" step={0.01} value={m.customInput ?? 0} onChange={(v) => update(i, { customInput: v })} />
                <NumberField label="Output $/1M" step={0.01} value={m.customOutput ?? 0} onChange={(v) => update(i, { customOutput: v })} />
              </div>
            ) : <p className="text-xs text-muted pb-2">Picks the cheapest model across providers for your token mix.</p>}
            <NumberField label="Share of AI traffic" value={m.sharePct} onChange={(v) => update(i, { sharePct: Math.min(100, v) })} suffix="%" />
            <div className="flex items-center gap-3 pb-1.5">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={m.caching} onChange={(e) => update(i, { caching: e.target.checked })} className="accent-primary" /> Prompt caching
              </label>
              {a.models.length > 1 && (
                <button type="button" aria-label="Remove model" className={btn.ghost} onClick={() => set({ models: a.models.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        </Card>
      ))}
      {totalShare !== 100 && <p className="text-xs text-amber-700">Traffic shares add up to {totalShare}% — they will be scaled to 100%.</p>}
      {a.models.length < 6 && (
        <button type="button" className={btn.secondary} onClick={() => set({ models: [...a.models, { provider: 'auto', modelId: '', sharePct: 0, caching: true }] })}>
          <Plus size={16} /> Add another model
        </button>
      )}
    </div>
  );
}

export function AgentEditor({ a, set }: { a: Answers; set: Set }) {
  const g = a.agent;
  const up = (p: Partial<Answers['agent']>) => set({ agent: { ...g, ...p } });
  const rate = USD_TO[a.currency];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <NumberField label="Connected tools" value={g.tools} onChange={(v) => up({ tools: v })} />
      <NumberField label="MCP servers" value={g.mcpServers} onChange={(v) => up({ mcpServers: v })} />
      <NumberField label="Tool calls per request" value={g.toolCallsPerRequest} onChange={(v) => up({ toolCallsPerRequest: v })} />
      <Select label="MCP execution" value={g.execution} onChange={(v) => up({ execution: v })} options={[{ value: 'remote', label: 'Remote (hosted)' }, { value: 'local', label: 'Local (stdio)' }]} />
      <NumberField label="Concurrent sessions" value={g.concurrentSessions} onChange={(v) => up({ concurrentSessions: v })} />
      <NumberField label="Background tasks" value={g.backgroundHoursPerDay} onChange={(v) => up({ backgroundHoursPerDay: Math.min(24, v) })} suffix="h/day" />
      <NumberField label={`Paid tool subscriptions (${a.currency})`} value={Math.round(g.thirdPartyFeesUsd * rate * 100) / 100} onChange={(v) => up({ thirdPartyFeesUsd: v / rate })} suffix="/mo"
        hint="Monthly fees for third-party APIs your tools call (e.g. search or scraping APIs). MCP itself has no per-call charge." />
    </div>
  );
}

export function StepAI({ a, set, d, preview }: { a: Answers; set: Set; d: Derived; preview: Estimate }) {
  const toggle = (u: AiUse) => set({ aiUses: a.aiUses.includes(u) ? a.aiUses.filter((x) => x !== u) : [...a.aiUses, u] });
  const ai = preview.services.filter((s) => s.slot === 'ai');
  const tokens = (label: string) => ai.reduce((s, x) => s + x.lines.filter((l) => l.label.startsWith(label)).reduce((t, l) => t + l.quantity, 0), 0);
  const agents = a.aiUses.includes('agents') || a.aiUses.includes('automation');

  return (
    <>
      <StepHeading title="Will your project use AI?" sub={a.aiUses.length ? 'We prefilled this from your features.' : 'Skip this if you don’t need AI.'} />
      <div role="group" aria-label="AI usage" className="flex flex-wrap gap-2">
        <Chip selected={a.aiUses.length === 0} onClick={() => set({ aiUses: [] })}>No AI</Chip>
        {AI_USES.map((u) => <Chip key={u} selected={a.aiUses.includes(u)} onClick={() => toggle(u)}>{AI_USE_INFO[u]}</Chip>)}
      </div>

      {a.aiUses.length > 0 && (
        <>
          <SubHeading>How much AI usage do you expect?</SubHeading>
          <div role="radiogroup" aria-label="AI usage level" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {keys(AI_LEVEL_INFO).map((l) => <ChoiceCard key={l} selected={a.aiLevel === l} onClick={() => set({ aiLevel: l })} title={AI_LEVEL_INFO[l].title} desc={AI_LEVEL_INFO[l].desc} />)}
          </div>
          {a.aiLevel === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <NumberField label="AI requests per month" value={a.aiCustom.requestsPerMonth} onChange={(v) => set({ aiCustom: { ...a.aiCustom, requestsPerMonth: v } })} />
              <NumberField label="Input tokens per request" value={a.aiCustom.inputTokens} onChange={(v) => set({ aiCustom: { ...a.aiCustom, inputTokens: v } })} hint="~750 words ≈ 1,000 tokens. Include system prompt and chat history." />
              <NumberField label="Output tokens per request" value={a.aiCustom.outputTokens} onChange={(v) => set({ aiCustom: { ...a.aiCustom, outputTokens: v } })} />
            </div>
          )}

          <SubHeading>Which models?</SubHeading>
          <ModelsEditor a={a} set={set} />

          {agents && (
            <>
              <SubHeading>AI agents and MCP tools</SubHeading>
              <AgentEditor a={a} set={set} />
            </>
          )}

          <Card className="mt-6 p-4">
            <h3 className="font-semibold text-sm mb-3">AI usage estimate (Recommended setup)</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              {[
                ['Requests / month', fmt(d.aiRequests)],
                ['Input tokens', fmt(tokens('Input') + tokens('Cached'))],
                ['…of which cached', fmt(tokens('Cached'))],
                ['Output tokens', fmt(tokens('Output'))],
                ['Model cost / month', money(ai.reduce((s, x) => s + x.monthlyUsd, 0), a.currency)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-canvas p-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted mt-3">Models used: {ai.map((s) => s.service).join(', ')}. Agent tool calls are counted as extra model turns; MCP has no per-call fee — only hosting, network and paid tools cost money.</p>
          </Card>
        </>
      )}
    </>
  );
}

// ---------- Step 4 ----------

export function StepBudget({ a, set }: { a: Answers; set: Set }) {
  return (
    <>
      <StepHeading title="What is your monthly budget?" sub="We use this to pick which architecture to highlight." />
      <div role="radiogroup" aria-label="Monthly budget" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {keys(BUDGET_INFO).map((b) => <ChoiceCard key={b} selected={a.budget === b} onClick={() => set({ budget: b })} title={BUDGET_INFO[b].title} />)}
      </div>
      <SubHeading>What matters most?</SubHeading>
      <div role="radiogroup" aria-label="Priority" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {keys(PRIORITY_INFO).map((p) => <ChoiceCard key={p} selected={a.priority === p} onClick={() => set({ priority: p })} title={PRIORITY_INFO[p].title} desc={PRIORITY_INFO[p].desc} />)}
      </div>
      <SubHeading>Preferred cloud provider</SubHeading>
      <div className="flex flex-wrap gap-2">{keys(PROVIDER_INFO).map((p) => <Chip key={p} selected={a.provider === p} onClick={() => set({ provider: p })}>{PROVIDER_INFO[p]}</Chip>)}</div>
      <SubHeading>Currency</SubHeading>
      <div className="flex flex-wrap gap-2">{CURRENCIES.map((c) => <Chip key={c} selected={a.currency === c} onClick={() => set({ currency: c })}>{c}</Chip>)}</div>
    </>
  );
}
