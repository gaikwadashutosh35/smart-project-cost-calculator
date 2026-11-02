import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Info, Loader2, ScanSearch, Sparkles } from 'lucide-react';
import type { ClaudeReview, PriceCheck } from '../../claude';
import { money } from '../calc/export';
import type { Currency, Scenario, Tier, Workload } from '../calc/types';
import { WORKLOAD_FIELDS } from './Advanced';
import { Card, btn, cx } from './kit';

type Call<T> = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; result: T };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  // A 429 from the host's rate limiter has no JSON body.
  if (!data.result) throw new Error(data.error ?? (r.status === 429 ? 'Too many requests — wait a few minutes and try again.' : `Request failed (${r.status}).`));
  return data.result as T;
}

const label = (field: keyof Workload) => WORKLOAD_FIELDS.find(([k]) => k === field)?.[1] ?? field;

interface Props {
  scenario: Scenario; tier: Tier; currency: Currency; w: Workload;
  onApplyWorkload: (field: keyof Workload, value: number) => void;
  onApplyPrice: (key: string, usd: number) => void;
}

export function ClaudePanel({ scenario, tier, currency, w, onApplyWorkload, onApplyPrice }: Props) {
  const [review, setReview] = useState<Call<ClaudeReview>>({ state: 'idle' });
  const [prices, setPrices] = useState<Call<PriceCheck[]>>({ state: 'idle' });
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const body = { answers: scenario.answers, workloadOverrides: scenario.workloadOverrides, advanced: scenario.advanced, tier };

  const run = async <T,>(set: (c: Call<T>) => void, url: string) => {
    set({ state: 'loading' });
    try { set({ state: 'done', result: await post<T>(url, body) }); } catch (e) { set({ state: 'error', message: (e as Error).message }); }
  };
  const mark = (k: string) => setApplied((s) => new Set(s).add(k));

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="brand-gradient grid place-items-center size-9 rounded-lg text-white shrink-0"><Sparkles size={18} /></span>
        <div>
          <h3 className="text-lg font-bold">Double-check with Claude</h3>
          <p className="text-sm text-muted">Claude reviews your assumptions or re-reads the official pricing pages. Nothing changes until you click “Apply”.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className={btn.primary} disabled={review.state === 'loading'} onClick={() => run(setReview, '/api/review')}>
          {review.state === 'loading' ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <ScanSearch size={16} />} Review my estimate
        </button>
        <button type="button" className={btn.secondary} disabled={prices.state === 'loading'} onClick={() => run(setPrices, '/api/check-prices')}>
          {prices.state === 'loading' ? <Loader2 size={16} className="motion-safe:animate-spin" /> : <ExternalLink size={16} />} Check prices live
        </button>
      </div>
      <p className="text-xs text-muted mt-2">The live price check reads each provider’s pricing page — it can take a few minutes and uses more API credits than a review.</p>

      {review.state === 'loading' && <p className="text-sm text-muted mt-4">Claude is reviewing your estimate…</p>}
      {review.state === 'error' && <p role="alert" className="text-sm text-red-700 mt-4">{review.message}</p>}
      {review.state === 'done' && (
        <section aria-label="Claude review" className="mt-5 space-y-3">
          <p className="text-sm">{review.result.summary}</p>
          {review.result.findings.map((f, i) => (
            <p key={i} className={cx('flex gap-2 text-sm', f.severity === 'warning' ? 'text-amber-800' : 'text-ink')}>
              {f.severity === 'warning' ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <Info size={16} className="shrink-0 mt-0.5 text-primary" />}
              <span><b>{f.title}.</b> {f.detail}</span>
            </p>
          ))}
          {review.result.missingServices.length > 0 && <p className="text-sm"><b>Possibly missing:</b> {review.result.missingServices.join(', ')}</p>}
          {review.result.workloadEdits.length > 0 && (
            <ul className="divide-y divide-line border border-line rounded-xl">
              {review.result.workloadEdits.map((e) => {
                const k = `w:${e.field}`;
                return (
                  <li key={k} className="p-3 flex flex-wrap items-center gap-3 justify-between text-sm">
                    <span><b>{label(e.field)}</b>: {+w[e.field].toFixed(2)} → <b>{+e.value.toFixed(2)}</b><span className="block text-xs text-muted">{e.reason}</span></span>
                    <button type="button" className={btn.secondary} disabled={applied.has(k) || e.value < 0} onClick={() => { onApplyWorkload(e.field, e.value); mark(k); }}>
                      {applied.has(k) ? <><Check size={16} /> Applied</> : 'Apply'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {prices.state === 'loading' && <p className="text-sm text-muted mt-4">Claude is reading the pricing pages for the services in this estimate…</p>}
      {prices.state === 'error' && <p role="alert" className="text-sm text-red-700 mt-4">{prices.message}</p>}
      {prices.state === 'done' && <PriceResults checks={prices.result} currency={currency} applied={applied} onApply={(c) => { onApplyPrice(c.key, c.newPriceUsd!); mark(c.key); }} />}
    </Card>
  );
}

function PriceResults({ checks, currency, applied, onApply }: { checks: PriceCheck[]; currency: Currency; applied: Set<string>; onApply: (c: PriceCheck) => void }) {
  const changed = checks.filter((c) => c.status === 'changed');
  const count = (s: PriceCheck['status']) => checks.filter((c) => c.status === s).length;
  const fmt = (usd: number) => money(usd, currency, usd < 1 ? 4 : 2);
  return (
    <section aria-label="Live price check" className="mt-5 space-y-3">
      <p className="text-sm">
        Checked {checks.length} prices: <b>{count('unchanged')}</b> unchanged, <b>{changed.length}</b> changed, <b>{count('not_found')}</b> not clearly stated on the page.
      </p>
      {changed.length > 0 && (
        <ul className="divide-y divide-line border border-line rounded-xl">
          {changed.map((c) => (
            <li key={c.key} className="p-3 flex flex-wrap items-center gap-3 justify-between text-sm">
              <span>
                <b>{c.item}</b> ({c.unit}): {fmt(c.currentUsd)} → <b>{fmt(c.newPriceUsd!)}</b>
                <span className="block text-xs text-muted">“{c.evidence}” · <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">source</a></span>
              </span>
              <button type="button" className={btn.secondary} disabled={applied.has(c.key)} onClick={() => onApply(c)}>
                {applied.has(c.key) ? <><Check size={16} /> Applied</> : 'Apply as my price'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-primary font-medium">All checked prices</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted border-b border-line"><th className="py-1.5 pr-3 font-medium">Item</th><th className="py-1.5 pr-3 font-medium">Catalogue</th><th className="py-1.5 pr-3 font-medium">Result</th><th className="py-1.5 font-medium">Evidence</th></tr></thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.key} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3">{c.item} <span className="text-muted">({c.unit})</span></td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmt(c.currentUsd)}</td>
                  <td className="py-1.5 pr-3">{c.status === 'changed' ? `Changed → ${fmt(c.newPriceUsd!)}` : c.status === 'unchanged' ? 'Unchanged' : 'Not found'}</td>
                  <td className="py-1.5">{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
