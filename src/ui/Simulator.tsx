import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { USD_TO } from '../calc/catalog';
import { estimate } from '../calc/engine';
import { money } from '../calc/export';
import type { Advanced, Answers, Group, Tier, Workload } from '../calc/types';
import { derive } from '../calc/workload';
import { Card, NumberField, cx } from './kit';

const PRESETS = [100, 1000, 10_000, 50_000, 100_000];

// Fixed colour per cost group (validated categorical order). Monitoring folds into "Other" to stay within 8 slots.
const SERIES: { key: string; groups: Group[]; color: string }[] = [
  { key: 'AI usage', groups: ['AI usage'], color: '#2a78d6' },
  { key: 'Database', groups: ['Database'], color: '#eb6834' },
  { key: 'Backend hosting', groups: ['Backend hosting'], color: '#1baf7a' },
  { key: 'Frontend hosting', groups: ['Frontend hosting'], color: '#eda100' },
  { key: 'APIs', groups: ['APIs'], color: '#e87ba4' },
  { key: 'Storage', groups: ['Storage'], color: '#008300' },
  { key: 'MCP infrastructure', groups: ['MCP infrastructure'], color: '#6250d6' },
  { key: 'Monitoring & other', groups: ['Monitoring', 'Other services'], color: '#e34948' },
];

export function Simulator({ a, w, adv, tier }: { a: Answers; w: Workload; adv: Advanced; tier: Tier }) {
  const [custom, setCustom] = useState(250_000);
  const points = useMemo(() => [...new Set([...PRESETS, w.registeredUsers, custom])].sort((x, y) => x - y), [w.registeredUsers, custom]);
  const rows = useMemo(() => points.map((users) => {
    const ww = { ...w, registeredUsers: users };
    const e = estimate(a, ww, tier, adv);
    const row: Record<string, number | string> = { users, label: users.toLocaleString('en-US'), total: e.monthlyUsd, mau: derive(ww, a).mau };
    for (const s of SERIES) row[s.key] = s.groups.reduce((t, g) => t + (e.byGroup[g] ?? 0), 0) * USD_TO[a.currency];
    return row;
  }), [points, a, w, adv, tier]);
  const series = SERIES.filter((s) => rows.some((r) => (r[s.key] as number) > 0));
  const axisMoney = (v: number) => money(v / USD_TO[a.currency], a.currency, 0);

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-lg font-bold">What happens when my users grow?</h3>
      <p className="text-sm text-muted mt-1">
        Each point re-runs the full estimate: free tiers run out, plans step up, servers are added for peak traffic and AI tokens grow with active users — so costs are not a straight multiple.
      </p>
      <div className="flex flex-wrap items-end gap-2 mt-3">
        <div className="w-44"><NumberField label="Try any user count" value={custom} onChange={setCustom} /></div>
      </div>
      <div className="h-72 mt-4" role="img" aria-label="Stacked bar chart of monthly cost by category at different user counts. The same numbers are in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e3e8ee" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748d' }} tickLine={false} axisLine={{ stroke: '#e3e8ee' }} />
            <YAxis tickFormatter={axisMoney} tick={{ fontSize: 12, fill: '#64748d' }} tickLine={false} axisLine={false} width={72} />
            <Tooltip
              formatter={(v, name) => [money(Number(v) / USD_TO[a.currency], a.currency), String(name)]}
              labelFormatter={(l) => `${l} registered users`}
              cursor={{ fill: '#efedff' }}
              contentStyle={{ borderRadius: 12, borderColor: '#e3e8ee', fontSize: 12 }}
              itemStyle={{ color: '#0d253d' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => <Bar key={s.key} dataKey={s.key} stackId="cost" fill={s.color} stroke="#FFFFFF" strokeWidth={2} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Monthly cost by registered users</caption>
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Registered users</th>
              <th className="py-2 pr-3 font-medium">Active users</th>
              <th className="py-2 pr-3 font-medium">Monthly</th>
              <th className="py-2 pr-3 font-medium">Annual</th>
              <th className="py-2 font-medium">Per active user</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.users as number} className={cx('border-b border-line/60', r.users === w.registeredUsers && 'bg-primary-soft font-semibold')}>
                <td className="py-1.5 pr-3">{r.label}{r.users === w.registeredUsers && ' (yours)'}</td>
                <td className="py-1.5 pr-3">{Math.round(r.mau as number).toLocaleString('en-US')}</td>
                <td className="py-1.5 pr-3">{money(r.total as number, a.currency)}</td>
                <td className="py-1.5 pr-3">{money((r.total as number) * 12, a.currency)}</td>
                <td className="py-1.5">{money((r.total as number) / Math.max(1, r.mau as number), a.currency, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
