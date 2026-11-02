import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { money } from './calc/export';
import { COMPUTE, supabaseBill, type SupabaseUsage } from './calc/supabase';
import { Chip, NumberField, Select, cx } from './ui/kit';

const START: SupabaseUsage = { plan: 'pro', compute: 'micro', dbGb: 6, egressGb: 120, mau: 20_000, storageGb: 40, realtimePeak: 300, realtimeMessages: 3_000_000, edgeInvocations: 1_000_000 };
const usd = (n: number) => money(n, 'USD', 2);
const qty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const unitUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 5 })}`;

function SupabaseCalculator() {
  const [u, setU] = useState<SupabaseUsage>(START);
  const set = (p: Partial<SupabaseUsage>) => setU((s) => ({ ...s, ...p }));
  const bill = supabaseBill(u);
  const fields: [keyof SupabaseUsage, string, string][] = [
    ['dbGb', 'Database size', 'GB'], ['egressGb', 'Egress (data sent out)', 'GB/mo'], ['mau', 'Monthly active users', 'MAU'],
    ['storageGb', 'File storage', 'GB'], ['realtimePeak', 'Realtime peak connections', ''], ['realtimeMessages', 'Realtime messages', '/mo'],
    ['edgeInvocations', 'Edge Function invocations', '/mo'],
  ];

  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
      <div>
        <div role="radiogroup" aria-label="Plan" className="flex gap-2">
          <Chip selected={u.plan === 'free'} onClick={() => set({ plan: 'free' })}>Free plan</Chip>
          <Chip selected={u.plan === 'pro'} onClick={() => set({ plan: 'pro' })}>Pro plan</Chip>
        </div>
        {u.plan === 'pro' && (
          <div className="mt-4 max-w-xs">
            <Select label="Compute size" value={u.compute} onChange={(v) => set({ compute: v })}
              options={(Object.keys(COMPUTE) as (keyof typeof COMPUTE)[]).map((k) => ({ value: k, label: `${COMPUTE[k].label} — ${COMPUTE[k].ram} RAM` }))} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {fields.map(([k, label, suffix]) => (
            <NumberField key={k} label={label} suffix={suffix} step={k === 'dbGb' || k === 'storageGb' ? 0.1 : 1} value={u[k] as number} onChange={(v) => set({ [k]: v })} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-canvas border border-line p-4 sm:p-5" aria-live="polite">
        <p className="eyebrow text-primary">Estimated monthly bill</p>
        <p className="text-[44px] leading-[1.1] font-light tracking-[-1.2px] tabular-nums mt-2">{usd(bill.totalUsd)}</p>
        <p className="text-sm text-muted">≈ {money(bill.totalUsd, 'INR')} · {usd(bill.totalUsd * 12)} a year</p>
        {u.plan === 'free' ? (
          bill.freeIssues.length ? (
            <div className="mt-4 text-sm">
              <p className="font-semibold text-amber-800">This usage doesn't fit the Free plan:</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-amber-800">{bill.freeIssues.map((i) => <li key={i}>{i}</li>)}</ul>
              <button type="button" className="mt-3 text-primary underline" onClick={() => set({ plan: 'pro' })}>See the Pro price for this usage</button>
            </div>
          ) : <p className="mt-4 text-sm">Fits every Free plan limit. Free projects are paused after a week of inactivity, so use Pro for anything in production.</p>
        ) : (
          <table className="w-full text-sm mt-4 tabular-nums">
            <caption className="sr-only">Supabase Pro bill by line</caption>
            <tbody>
              {bill.lines.map((l) => (
                <tr key={l.label} className="border-t border-line/70 align-top">
                  <td className="py-1.5 pr-2">
                    {l.label}
                    {l.unit !== 'month' && <span className="block text-xs text-muted">{qty(l.quantity)} used · {qty(l.included)} included · {unitUsd(l.unitPrice)} per {l.per > 1 ? `${qty(l.per)} ` : ''}{l.unit}</span>}
                  </td>
                  <td className={cx('py-1.5 text-right whitespace-nowrap', l.costUsd === 0 && 'text-muted')}>{usd(l.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted mt-3">Excludes taxes. Shows what you would pay with the spend cap turned off (Supabase turns it on by default on Pro).</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('supabase-calc')!).render(<SupabaseCalculator />);
