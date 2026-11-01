import { money } from '../calc/export';
import { AI_USE_INFO, BUDGET_INFO, FEATURE_INFO, FREQUENCY_INFO, GEO_INFO, GROWTH_INFO, PRIORITY_INFO, PROJECT_INFO, PROVIDER_INFO, USER_INFO } from '../calc/questionnaire';
import { TIER_INFO } from '../calc/recommend';
import { TIERS, type Answers, type Estimate, type Tier, type Workload } from '../calc/types';
import type { Derived } from '../calc/workload';
import { Disclaimer } from './Results';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Print-only report. "PDF report" prints this via the browser (Save as PDF). */
export function Report({ a, w, d, estimates, view, name }: { a: Answers; w: Workload; d: Derived; estimates: Record<Tier, Estimate>; view: Tier; name: string }) {
  const e = estimates[view];
  const c = a.currency;
  const th = 'text-left border-b border-gray-300 py-1 pr-2';
  const td = 'border-b border-gray-200 py-1 pr-2 align-top';
  return (
    <div className="hidden print:block text-[11px] text-black">
      <h1 className="text-2xl font-bold">{name || 'Project'} — Cost Estimate</h1>
      <p className="text-gray-600">Generated {new Date().toLocaleDateString()} · Smart Project Cost Calculator</p>

      <h2 className="text-base font-bold mt-4 mb-1">Project</h2>
      <p>{a.projectType ? PROJECT_INFO[a.projectType].title : 'Custom'} · {USER_INFO[a.users]} users · {FREQUENCY_INFO[a.frequency].title} use · {GEO_INFO[a.geography]} · {GROWTH_INFO[a.growth].title} growth</p>
      <p>Features: {a.features.map((f) => FEATURE_INFO[f]).join(', ') || 'None'}</p>
      <p>AI: {a.aiUses.map((u) => AI_USE_INFO[u]).join(', ') || 'None'}</p>
      <p>Budget: {BUDGET_INFO[a.budget].title} · Priority: {PRIORITY_INFO[a.priority].title} · Provider preference: {PROVIDER_INFO[a.provider]}</p>
      {a.description && <p className="italic mt-1">“{a.description}”</p>}

      <h2 className="text-base font-bold mt-4 mb-1">Workload assumptions</h2>
      <p>
        {fmt(w.registeredUsers)} registered users · {w.activePct}% active ({fmt(d.mau)} MAU) · {w.sessionsPerMau} sessions/user/month · {fmt(d.requests)} API requests/month ·
        {' '}{fmt(d.dbOps)} DB operations · {(d.dbStorageGb + d.fileStorageGb).toFixed(1)} GB storage · {(d.frontendEgressGb + d.apiEgressGb + d.fileEgressGb).toFixed(1)} GB bandwidth ·
        {' '}peak {d.peakRps.toFixed(2)} req/s ({w.peakMultiplier}× average){d.aiRequests > 0 && ` · ${fmt(d.aiRequests)} AI requests (${w.aiInputTokens} in / ${w.aiOutputTokens} out tokens each)`}
      </p>

      <h2 className="text-base font-bold mt-4 mb-1">Architecture options</h2>
      <table className="w-full">
        <thead><tr><th className={th}>Option</th><th className={th}>Monthly</th><th className={th}>Annual</th><th className={th}>Setup</th></tr></thead>
        <tbody>{TIERS.map((t) => <tr key={t}><td className={td}>{TIER_INFO[t].title}{t === view && ' (shown below)'}</td><td className={td}>{money(estimates[t].monthlyUsd, c)}</td><td className={td}>{money(estimates[t].annualUsd, c)}</td><td className={td}>{money(estimates[t].setupUsd, c)}</td></tr>)}</tbody>
      </table>

      <h2 className="text-base font-bold mt-4 mb-1">{TIER_INFO[view].title} architecture — services</h2>
      <table className="w-full">
        <thead><tr><th className={th}>Category</th><th className={th}>Provider / service</th><th className={th}>Plan</th><th className={th}>Why</th><th className={th}>Monthly</th><th className={th}>Annual</th></tr></thead>
        <tbody>
          {e.services.map((s, i) => (
            <tr key={i}><td className={td}>{s.group}</td><td className={td}>{s.provider} {s.service}</td><td className={td}>{s.plan}</td><td className={td}>{s.why}</td><td className={td}>{money(s.monthlyUsd, c)}</td><td className={td}>{money(s.monthlyUsd * 12, c)}</td></tr>
          ))}
          <tr className="font-bold"><td className={td} colSpan={4}>Total</td><td className={td}>{money(e.monthlyUsd, c)}</td><td className={td}>{money(e.annualUsd, c)}</td></tr>
        </tbody>
      </table>

      <h2 className="text-base font-bold mt-4 mb-1" style={{ breakBefore: 'page' }}>Detailed breakdown</h2>
      <table className="w-full">
        <thead><tr><th className={th}>Service</th><th className={th}>Item</th><th className={th}>Calculation (USD)</th><th className={th}>Status</th><th className={th}>Monthly</th></tr></thead>
        <tbody>{e.services.flatMap((s, i) => s.lines.map((l, j) => <tr key={`${i}-${j}`}><td className={td}>{s.provider} {s.service}</td><td className={td}>{l.label}</td><td className={td}>{l.formula}</td><td className={td}>{l.status}</td><td className={td}>{money(l.monthlyUsd, c, 2)}</td></tr>))}</tbody>
      </table>

      <h2 className="text-base font-bold mt-4 mb-1">Pricing sources</h2>
      <ul className="list-disc pl-4">{[...new Map(e.services.filter((s) => s.sourceUrl).map((s) => [s.sourceUrl, s])).values()].map((s) => <li key={s.sourceUrl}>{s.provider} {s.service}: {s.sourceUrl} (checked {s.checked})</li>)}</ul>

      <div className="mt-4"><Disclaimer /></div>
    </div>
  );
}
