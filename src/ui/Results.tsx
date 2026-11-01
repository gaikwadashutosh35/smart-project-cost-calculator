import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, FileDown, FileSpreadsheet, Link2, Pencil, Save, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { FX_DATE, FX_SOURCE } from '../calc/catalog';
import { estimate } from '../calc/engine';
import { encodeShare, money, summaryText, toCsv } from '../calc/export';
import { BUDGET_INFO, GROWTH_INFO } from '../calc/questionnaire';
import { TIER_INFO, budgetMaxUsd, narrative } from '../calc/recommend';
import { TIERS, type Advanced, type Answers, type Estimate, type Group, type Scenario, type ServiceCost, type Tier, type Workload } from '../calc/types';
import type { Derived } from '../calc/workload';
import { Card, StatusBadge, btn, cx } from './kit';
import { Simulator } from './Simulator';
import { ClaudePanel } from './ClaudePanel';

const GROUP_ORDER: Group[] = ['Frontend hosting', 'Backend hosting', 'Database', 'Storage', 'AI usage', 'APIs', 'MCP infrastructure', 'Monitoring', 'Other services'];

interface Props {
  a: Answers; w: Workload; d: Derived; adv: Advanced; estimates: Record<Tier, Estimate>; chosen: { tier: Tier; reason: string };
  view: Tier; setView: (t: Tier) => void; scenario: Scenario; onEdit: (step: number) => void; onAdvanced: () => void; onSave: () => void; onDuplicate: () => void;
  onApplyWorkload: (field: keyof Workload, value: number) => void; onApplyPrice: (key: string, usd: number) => void;
}

export function Results({ a, w, d, adv, estimates, chosen, view, setView, scenario, onEdit, onAdvanced, onSave, onDuplicate, onApplyWorkload, onApplyPrice }: Props) {
  const e = estimates[view];
  const c = a.currency;
  const [copied, setCopied] = useState<string | null>(null);
  const max = budgetMaxUsd(a);
  const growth = GROWTH_INFO[a.growth];
  const future = useMemo(() => estimate(a, { ...w, registeredUsers: Math.round(w.registeredUsers * growth.factor) }, view, adv), [a, w, view, adv, growth.factor]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(e, c)], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${scenario.name.replace(/[^\w-]+/g, '-') || 'estimate'}-${view}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };
  const shareUrl = () => `${location.origin}${location.pathname}#s=${encodeShare(scenario)}`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-4 sm:p-6 overflow-hidden relative">
        <span aria-hidden className="brand-gradient absolute inset-x-0 top-0 h-1" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-primary">Estimated monthly cost · {TIER_INFO[view].title}</p>
            <p className="text-[44px] sm:text-[56px] leading-[1.12] font-light tracking-[-1.4px] tabular-nums mt-2">{money(e.monthlyUsd, c)}</p>
            <p className="text-sm text-muted mt-1">{money(e.annualUsd, c)} per year{e.setupUsd > 0 && ` · ${money(e.setupUsd, c)} one-time setup`}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" className={btn.secondary} onClick={() => onEdit(0)}><Pencil size={16} /> Edit answers</button>
            <button type="button" className={btn.secondary} onClick={onAdvanced}><SlidersHorizontal size={16} /> Customize technical configuration</button>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
          {[
            ['Cost per active user', money(e.perMauUsd, c, 2), `${Math.round(d.mau).toLocaleString('en-US')} MAU`],
            ['Setup cost', e.setupUsd ? money(e.setupUsd, c) : 'None', 'One-time fees'],
            ['Budget', BUDGET_INFO[a.budget].title, a.budget === 'unsure' ? 'No limit set' : e.monthlyUsd <= max ? 'Within budget' : `Over by ${money(e.monthlyUsd - max, c)}`],
            ['Highlighted option', TIER_INFO[chosen.tier].title, chosen.reason],
          ].map(([k, v, sub]) => (
            <div key={k} className="rounded-xl bg-canvas border border-line p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold mt-0.5">{v}</dd>
              <dd className={cx('text-xs mt-0.5', sub.startsWith('Over') ? 'text-red-700' : 'text-muted')}>{sub}</dd>
            </div>
          ))}
        </dl>
        {e.warnings.length > 0 && (
          <ul className="mt-4 space-y-1">{e.warnings.map((x) => <li key={x} className="flex gap-2 text-sm text-amber-800"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{x}</li>)}</ul>
        )}
        <div className="flex flex-wrap gap-2 mt-5 print:hidden">
          <button type="button" className={btn.primary} onClick={() => window.print()}><FileDown size={16} /> PDF report</button>
          <button type="button" className={btn.secondary} onClick={downloadCsv}><FileSpreadsheet size={16} /> CSV breakdown</button>
          <button type="button" className={btn.secondary} onClick={() => copy(shareUrl(), 'link')}>{copied === 'link' ? <Check size={16} /> : <Link2 size={16} />} Share link</button>
          <button type="button" className={btn.secondary} onClick={() => copy(summaryText(a, e), 'summary')}>{copied === 'summary' ? <Check size={16} /> : <Copy size={16} />} Copy summary</button>
          <button type="button" className={btn.secondary} onClick={onSave}><Save size={16} /> Save scenario</button>
          <button type="button" className={btn.secondary} onClick={onDuplicate}><Copy size={16} /> Duplicate</button>
        </div>
        <p className="text-xs text-muted mt-2 print:hidden">“PDF report” opens your browser’s print dialog — choose “Save as PDF”.</p>
      </Card>

      {/* Three architectures */}
      <section aria-labelledby="arch-h">
        <h2 id="arch-h" className="text-2xl font-bold tracking-[-0.256px] mb-1">Compare architectures</h2>
        <p className="text-sm text-muted mb-4">Select an option to see its services and costs below.</p>
        <div role="tablist" className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t, i) => {
            const x = estimates[t];
            const n = narrative(x);
            const dark = chosen.tier === t; // featured tier is polarity-flipped
            const sub = dark ? 'text-white/70' : 'text-muted';
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={view === t}
                onClick={() => setView(t)}
                className={cx(
                  'text-left rounded-2xl border p-5 motion-safe:transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  dark ? 'bg-brand-dark text-white border-brand-dark shadow-float' : 'bg-surface border-line shadow-card hover:border-primary/40',
                  view === t && 'ring-2 ring-primary ring-offset-2 ring-offset-canvas',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('eyebrow', dark ? 'text-white/80' : 'text-muted')}>/0.{i + 1} · {TIER_INFO[t].title}</span>
                  {dark && <span className="text-[11px] font-bold bg-white text-brand-dark rounded-full px-2.5 py-1">Best fit</span>}
                </div>
                <p className="text-[36px] leading-[1.12] font-light tracking-[-0.8px] tabular-nums mt-4">{money(x.monthlyUsd, c)}<span className={cx('text-sm font-normal tracking-normal', sub)}>/month</span></p>
                <p className={cx('text-xs mt-1', sub)}>{money(x.annualUsd, c)}/year · {TIER_INFO[t].tagline}</p>
                <ul className={cx('text-xs mt-4 pt-3 border-t space-y-1', dark ? 'border-white/15' : 'border-line')}>
                  {x.services.filter((s) => ['frontend', 'backend', 'database', 'auth', 'storage', 'ai'].includes(s.slot)).map((s, j) => (
                    <li key={j} className="truncate"><span className={cx('capitalize', sub)}>{s.slot}:</span> {s.provider} {s.slot === 'ai' ? s.service : s.service.split(' (')[0]}</li>
                  ))}
                </ul>
                <div className={cx('text-xs mt-3 pt-3 border-t space-y-1.5', dark ? 'border-white/15' : 'border-line')}>
                  <p><b className={dark ? 'text-emerald-300' : 'text-emerald-700'}>+</b> {n.advantages.join(' · ')}</p>
                  <p><b className={dark ? 'text-rose-300' : 'text-red-700'}>−</b> {n.limitations.join(' · ')}</p>
                  <p><b className={dark ? 'text-indigo-300' : 'text-primary'}>↗</b> {n.upgrades.join(' · ')}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto mt-4 bg-surface border border-line rounded-2xl shadow-card">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Monthly cost by category for each architecture</caption>
            <thead><tr className="text-left text-xs text-muted border-b border-line"><th className="px-4 py-3 font-medium">Category</th>{TIERS.map((t) => <th key={t} className="px-4 py-3 font-medium">{TIER_INFO[t].title}</th>)}</tr></thead>
            <tbody>
              {GROUP_ORDER.filter((g) => TIERS.some((t) => estimates[t].byGroup[g] !== undefined)).map((g) => (
                <tr key={g} className="border-b border-line/60"><td className="px-4 py-2.5">{g}</td>{TIERS.map((t) => <td key={t} className="px-4 py-2.5">{estimates[t].byGroup[g] === undefined ? '—' : money(estimates[t].byGroup[g]!, c)}</td>)}</tr>
              ))}
              <tr className="font-semibold"><td className="px-4 py-2.5">Total / month</td>{TIERS.map((t) => <td key={t} className="px-4 py-2.5">{money(estimates[t].monthlyUsd, c)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Breakdown */}
      <Breakdown e={e} c={c} />

      {/* Growth outlook */}
      <Card className="p-4 sm:p-5 flex gap-3 items-start">
        <TrendingUp className="text-primary shrink-0" size={22} />
        <div>
          <h3 className="font-semibold">12-month outlook ({growth.title.toLowerCase()} growth)</h3>
          <p className="text-sm text-muted mt-1">
            If registered users grow {growth.factor}× to about {Math.round(w.registeredUsers * growth.factor).toLocaleString('en-US')}, this architecture would cost about{' '}
            <b className="text-ink">{money(future.monthlyUsd, c)}/month</b> ({money(future.perMauUsd, c, 2)} per active user).
          </p>
        </div>
      </Card>

      {/* Services */}
      <section aria-labelledby="svc-h">
        <h2 id="svc-h" className="text-2xl font-bold tracking-[-0.256px] mb-1">Services in the {TIER_INFO[view].title} architecture</h2>
        <p className="text-sm text-muted mb-3">Open any service to see exactly how its cost is calculated.</p>
        <div className="space-y-2.5">{e.services.map((s, i) => <ServiceCard key={s.entryId + i} s={s} c={c} />)}</div>
      </section>

      <ClaudePanel scenario={scenario} tier={view} currency={c} w={w} onApplyWorkload={onApplyWorkload} onApplyPrice={onApplyPrice} />

      <Simulator a={a} w={w} adv={adv} tier={view} />

      <Disclaimer />
    </div>
  );
}

function Breakdown({ e, c }: { e: Estimate; c: Answers['currency'] }) {
  const rows = GROUP_ORDER.filter((g) => e.byGroup[g] !== undefined).map((g) => [g, e.byGroup[g]!] as const).sort((x, y) => y[1] - x[1]);
  const top = Math.max(...rows.map((r) => r[1]), 1e-9);
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-lg font-bold mb-4">Where the money goes</h3>
      <ul className="space-y-2.5">
        {rows.map(([g, v]) => (
          <li key={g} className="grid grid-cols-[8.5rem_1fr_auto] sm:grid-cols-[10rem_1fr_7rem] items-center gap-3 text-sm" title={`${g}: ${money(v, c)} per month`}>
            <span className="truncate">{g}</span>
            <span className="h-3 rounded-r bg-canvas overflow-hidden"><span className="block h-full bg-primary rounded-r" style={{ width: `${Math.max(v > 0 ? 1 : 0, (v / top) * 100)}%` }} /></span>
            <span className="text-right tabular-nums">{money(v, c)} <span className="text-xs text-muted">{e.monthlyUsd ? Math.round((v / e.monthlyUsd) * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ServiceCard({ s, c }: { s: ServiceCost; c: Answers['currency'] }) {
  const statuses = [...new Set(s.lines.map((l) => l.status))];
  return (
    <details className="group bg-surface border border-line rounded-2xl shadow-card open:border-primary/40">
      <summary className="cursor-pointer list-none p-4 flex flex-wrap items-start gap-x-4 gap-y-1 justify-between">
        <span className="min-w-0">
          <span className="text-xs text-muted">{s.group}</span>
          <span className="block font-semibold">{s.provider} · {s.service}</span>
          <span className="block text-xs text-muted">{s.plan} · {s.purpose}</span>
        </span>
        <span className="text-right">
          {s.slot === 'payments' || s.slot === 'subscriptions'
            ? <span className="block text-sm font-medium">% fee on revenue</span>
            : <span className="block font-semibold tabular-nums">{money(s.monthlyUsd, c)}<span className="text-xs font-normal text-muted">/mo</span></span>}
          <span className="flex gap-1 justify-end mt-1">{statuses.map((st) => <StatusBadge key={st} status={st} />)}</span>
        </span>
      </summary>
      <div className="px-4 pb-4 text-sm space-y-3 border-t border-line pt-3">
        <p><b>Why it’s needed:</b> {s.why}</p>
        <p><b>Usage assumed:</b> {s.usageSummary} · <span className="text-muted">Region: {s.region}</span></p>
        {s.notes.length > 0 && <ul className="list-disc pl-5 text-muted space-y-0.5">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        {s.warnings.map((x) => <p key={x} className="flex gap-2 text-amber-800"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{x}</p>)}
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead><tr className="text-left text-muted border-b border-line"><th className="py-1.5 pr-3 font-medium">Item</th><th className="py-1.5 pr-3 font-medium">Calculation (USD)</th><th className="py-1.5 pr-3 font-medium">Status</th><th className="py-1.5 font-medium text-right">{c}/mo</th></tr></thead>
            <tbody>
              {s.lines.map((l, i) => (
                <tr key={i} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3">{l.label}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] break-all">{l.formula}</td>
                  <td className="py-1.5 pr-3"><StatusBadge status={l.status} /></td>
                  <td className="py-1.5 text-right">{money(l.monthlyUsd, c, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">Official pricing <ExternalLink size={12} /></a>}
          {s.checked && <span>Last checked {s.checked}</span>}
          <span>Lock-in: {s.lockIn}</span>
          {s.alternatives.length > 0 && <span>Alternatives: {s.alternatives.join(', ')}</span>}
        </div>
      </div>
    </details>
  );
}

export function Disclaimer() {
  return (
    <p className="text-xs text-muted leading-relaxed">
      Estimates only. Prices come from providers’ official pricing pages (checked on the date shown per service) and assume the usage shown — real bills depend on actual traffic.
      Taxes (e.g. GST/VAT) and payment-processing fees (a % of your revenue) are excluded. Currency converted at ECB reference rates of {FX_DATE} (<a className="underline" href={FX_SOURCE} target="_blank" rel="noreferrer noopener">source</a>).
      “Estimate” marks prices or allowances that could not be verified; “Your price” marks values you entered.
    </p>
  );
}
