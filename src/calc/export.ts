import { FX_DATE, USD_TO } from './catalog';
import { FEATURE_INFO, PROJECT_INFO, USER_INFO, GEO_INFO } from './questionnaire';
import { TIER_INFO } from './recommend';
import { ScenarioSchema, type Answers, type Currency, type Estimate, type Scenario } from './types';

export const SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function money(usd: number, ccy: Currency, digits?: number): string {
  const v = usd * USD_TO[ccy];
  const d = digits ?? (Math.abs(v) < 10 && v !== 0 ? 2 : 0);
  return `${SYMBOL[ccy]}${v.toLocaleString(ccy === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(e: Estimate, ccy: Currency): string {
  const rate = USD_TO[ccy];
  const head = ['Architecture', 'Category', 'Provider', 'Service', 'Plan', 'Region', 'Line item', 'Quantity', 'Unit', `Unit price (${ccy})`, 'Per', 'Included',
    'Native price', 'Native currency', 'Billing period', `Monthly (${ccy})`, `Annual (${ccy})`, `Setup (${ccy})`, 'Price status', 'Formula', 'Pricing source', 'Last checked'];
  const rows = e.services.flatMap((s) => s.lines.map((l) => [
    TIER_INFO[e.tier].title, s.group, s.provider, s.service, s.plan, s.region, l.label, Math.round(l.quantity * 100) / 100, l.unit,
    +(l.unitPriceUsd * rate).toPrecision(6), l.per, l.included, l.nativeUnitPrice, l.nativeCurrency, l.period,
    (l.monthlyUsd * rate).toFixed(2), (l.monthlyUsd * rate * 12).toFixed(2), (l.setupUsd * rate).toFixed(2), l.status, l.formula, s.sourceUrl, s.checked,
  ]));
  const total = ['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', '', '', (e.monthlyUsd * rate).toFixed(2), (e.annualUsd * rate).toFixed(2), (e.setupUsd * rate).toFixed(2)];
  return [head, ...rows, total].map((r) => r.map(csvCell).join(',')).join('\n') + `\n\nCurrency converted at ECB reference rates of ${FX_DATE}.\n`;
}

export function summaryText(a: Answers, e: Estimate): string {
  const c = a.currency;
  return [
    `Project: ${a.projectType ? PROJECT_INFO[a.projectType].title : 'Custom'}`,
    `Features: ${a.features.map((f) => FEATURE_INFO[f]).join(', ') || 'None selected'}`,
    `Users: ${USER_INFO[a.users]} · ${GEO_INFO[a.geography]}`,
    `Architecture: ${TIER_INFO[e.tier].title}`,
    `Estimated cost: ${money(e.monthlyUsd, c)}/month · ${money(e.annualUsd, c)}/year${e.setupUsd ? ` · ${money(e.setupUsd, c)} setup` : ''}`,
    '',
    ...e.services.map((s) => `• ${s.provider} ${s.service} (${s.plan}): ${money(s.monthlyUsd, c)}/mo`),
    '',
    'Estimates only — based on published prices and assumed usage. Taxes and payment-processing fees excluded.',
  ].join('\n');
}

// Share links carry the scenario in the URL hash (never sent to a server). No secrets are stored in scenarios.
export function encodeShare(s: Scenario): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(hash: string): Scenario | null {
  try {
    const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));
    const parsed = ScenarioSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
