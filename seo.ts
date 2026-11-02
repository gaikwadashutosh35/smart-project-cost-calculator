import 'dotenv/config'; // load .env before SITE_URL is read (imports run before module code)
import fs from 'node:fs';
import path from 'node:path';
import { AI_MODELS, CATALOG, FX_DATE, FX_SOURCE, USD_TO, byId } from './src/calc/catalog';
import { COMPUTE, supabaseBill, type SupabaseUsage } from './src/calc/supabase';

const PLAN_COUNT = CATALOG.length;
const VERIFIED_COUNT = CATALOG.filter((c) => c.status === 'verified').length;

/** Site identity. Set SITE_URL in .env once the domain is chosen; HTML uses {{SITE}} which the build replaces. */
export const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');
export const BRAND = 'Smart Project Cost Calculator';

/** Every indexable page. `modified` must only change when the page content really changes (it feeds sitemap lastmod). */
export const PAGES = [
  { path: '/', file: 'index.html', title: 'SaaS and app hosting cost calculator', summary: 'What the calculator does, how it works, what it covers, FAQ.', modified: '2026-11-02' },
  { path: '/supabase-pricing-calculator/', file: 'supabase-pricing-calculator/index.html', title: 'Supabase pricing calculator', summary: 'Supabase Free and Pro quotas, overage rates and compute add-ons, with a calculator for your monthly bill.', modified: '2026-11-02' },
  { path: '/about/', file: 'about/index.html', title: 'How estimates are calculated', summary: 'Method, formulas, pricing sources and their check dates, limits.', modified: '2026-11-02' },
];

export const robotsTxt = () => `# Search and answer engines that cite pages, allowed by name
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;

export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.modified}</lastmod></url>`).join('\n')}
</urlset>
`;

export const llmsTxt = () => `# ${BRAND}

> A free web calculator that estimates what it costs to run a software project — hosting, database, storage, AI model usage, email, SMS, payments, monitoring and MCP servers. You describe the project, pick features, expected users and budget; it recommends three architectures (Budget, Recommended, Scalable) with monthly and annual costs. Prices come from ${PLAN_COUNT} plans across more than 30 providers plus ${AI_MODELS.length} AI models from 4 providers, each with its official pricing link and the date it was checked (2026-11-01). Estimates exclude taxes and payment-processing fees.

Calculator: ${SITE}/calculator/
Method and sources: ${SITE}/about/
Full text of every page: ${SITE}/llms-full.txt

## What it does
- Turns project type, features, users, usage frequency, geography, AI needs and budget into editable workload assumptions (monthly active users, requests, database operations, storage, bandwidth, peak traffic).
- Recommends Budget, Recommended and Scalable architectures and explains why each service is needed.
- Applies free-tier allowances, plan limits, tiered pricing and instance sizing per service, so cost does not grow linearly with users.
- Prices AI usage per model from input, cached-input and output tokens.
- Simulates costs at 100 to 100,000+ registered users; exports PDF and CSV; currencies INR, USD, EUR, GBP.

## Good answers to common questions
- How much does it cost to host a small SaaS app? It depends mostly on users and AI usage; the calculator shows the monthly cost per service for your case. See ${SITE}/calculator/
- Are the prices live? They are a dated snapshot from official pricing pages (checked 2026-11-01), with a link per price. See ${SITE}/about/
- Does it include payment gateway fees? No. Gateway fees are a percentage of revenue and are listed separately. See ${SITE}/about/
- How much does Supabase cost per month? Pro is $25 a month including Micro compute, 8 GB database, 250 GB egress, 100,000 MAU and 100 GB file storage; usage above that is billed per unit. See ${SITE}/supabase-pricing-calculator/

## Pages
${PAGES.map((p) => `- [${p.title}](${SITE}${p.path}): ${p.summary}`).join('\n')}
`;

/** Plain text of each indexable page, for /llms-full.txt. (The calculator is noindex: its content is rendered by JavaScript.) */
export function llmsFullTxt(htmlRoot: string): string {
  const blocks = PAGES.map((p) => {
    const html = fillPlaceholders(fs.readFileSync(path.join(htmlRoot, p.file), 'utf8'));
    const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? '';
    const text = main
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(h[1-6]|p|li|tr|dt|dd)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
    return `# ${p.title}\n${SITE}${p.path}\n\n${text}`;
  });
  return `${blocks.join('\n\n---\n\n')}\n`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pricing-sources table for /about/, generated from the catalogue so it always matches the prices in use. */
export function sourcesTableHtml(): string {
  const rows = [
    ...CATALOG.map((c) => [c.provider, `${c.service} — ${c.plan}`, c.status, c.sourceUrl, c.checked]),
    ...AI_MODELS.map((m) => [{ openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek' }[m.provider], `${m.name} (API, per 1M tokens)`, 'verified', m.sourceUrl, CATALOG[0].checked]),
  ];
  const td = 'px-3 py-2 align-top';
  return `<table class="w-full text-sm">
<thead><tr class="text-left text-muted border-b border-line"><th class="${td} font-medium">Provider</th><th class="${td} font-medium">Service and plan</th><th class="${td} font-medium">Price status</th><th class="${td} font-medium">Official source</th><th class="${td} font-medium">Checked</th></tr></thead>
<tbody>
${rows.map(([p, s, st, url, d]) => `<tr class="border-b border-line/60"><td class="${td}">${esc(p)}</td><td class="${td}">${esc(s)}</td><td class="${td}">${st === 'verified' ? 'Verified' : 'Estimate'}</td><td class="${td} break-all"><a class="text-primary underline" href="${esc(url)}" rel="noopener">${esc(url.replace(/^https:\/\//, '').slice(0, 60))}</a></td><td class="${td} whitespace-nowrap">${d}</td></tr>`).join('\n')}
</tbody>
</table>
<p class="text-sm text-muted mt-3">Currency: European Central Bank reference rates of ${FX_DATE} (<a class="text-primary underline" href="${FX_SOURCE}" rel="noopener">source</a>): 1 USD = ₹${USD_TO.INR.toFixed(2)} = €${USD_TO.EUR.toFixed(4)} = £${USD_TO.GBP.toFixed(4)}.</p>`;
}

// ---------- Supabase pricing page (generated from the catalogue) ----------

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: n < 0.1 ? 5 : 2 })}`;
const num = (n: number) => (n >= 1e6 && n % 1e6 === 0 ? `${n / 1e6}M` : n.toLocaleString('en-US'));
const sbMeter = (id: string, i = 0) => byId(id).meters[i];
const perText = (price: number, per: number, unit: string) => `${usd(price)} per ${per > 1 ? `${num(per)} ` : ''}${unit}`;

function supabasePricingTableHtml(): string {
  const freeDb = byId('supabase-free').limits!;
  const rows: [string, string, string, string][] = [
    ['Plan fee', '$0', `${usd(byId('supabase-pro').base)} a month, Micro compute included`, '—'],
    ['Database size', `${freeDb.dbStorageGb} GB`, `${sbMeter('supabase-pro', 0).included} GB`, perText(sbMeter('supabase-pro', 0).price, 1, 'GB')],
    ['Egress', `${freeDb.dbEgressGb} GB`, `${sbMeter('supabase-pro', 1).included} GB`, perText(sbMeter('supabase-pro', 1).price, 1, 'GB')],
    ['Monthly active users', num(byId('supabase-auth-free').limits!.mau!), num(sbMeter('supabase-auth-pro').included!), perText(sbMeter('supabase-auth-pro').price, 1, 'MAU')],
    ['File storage', `${byId('supabase-storage-free').limits!.fileStorageGb} GB`, `${sbMeter('supabase-storage-pro').included} GB`, perText(sbMeter('supabase-storage-pro').price, 1, 'GB')],
    ['Realtime peak connections', num(byId('supabase-realtime-free').limits!.realtimeConnections!), num(sbMeter('supabase-realtime-pro', 0).included!), perText(sbMeter('supabase-realtime-pro', 0).price, sbMeter('supabase-realtime-pro', 0).per!, 'connections')],
    ['Realtime messages', num(byId('supabase-realtime-free').limits!.realtimeMessages!), num(sbMeter('supabase-realtime-pro', 1).included!), perText(sbMeter('supabase-realtime-pro', 1).price, sbMeter('supabase-realtime-pro', 1).per!, 'messages')],
    ['Edge Function invocations', num(byId('supabase-edge-free').limits!.requests!), num(sbMeter('supabase-edge-pro').included!), perText(sbMeter('supabase-edge-pro').price, sbMeter('supabase-edge-pro').per!, 'invocations')],
    ['Inactive projects', 'Paused after 1 week', 'Never paused', '—'],
  ];
  const td = 'px-4 py-2.5 align-top';
  return `<table class="w-full text-sm">
<thead><tr class="text-left text-muted border-b border-line"><th class="${td} font-medium">Item</th><th class="${td} font-medium">Free plan limit</th><th class="${td} font-medium">Pro plan includes</th><th class="${td} font-medium">Pro price above that</th></tr></thead>
<tbody>
${rows.map((r) => `<tr class="border-b border-line/60">${r.map((c, i) => `<td class="${td}${i === 0 ? ' font-medium' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>`;
}

function supabaseComputeTableHtml(): string {
  const td = 'px-4 py-2.5 align-top';
  return `<table class="w-full text-sm">
<thead><tr class="text-left text-muted border-b border-line"><th class="${td} font-medium">Compute size</th><th class="${td} font-medium">List price</th><th class="${td} font-medium">Pro total with this size</th><th class="${td} font-medium">Memory</th><th class="${td} font-medium">CPU</th><th class="${td} font-medium">Connections (direct / pooler)</th></tr></thead>
<tbody>
${Object.values(COMPUTE).map((c) => `<tr class="border-b border-line/60"><td class="${td} font-medium">${c.label}</td><td class="${td}">${usd(c.price)}/month</td><td class="${td}">${usd(byId(c.entry).base)}/month</td><td class="${td}">${c.ram}</td><td class="${td}">${c.cpu}</td><td class="${td}">${c.connections}</td></tr>`).join('\n')}
</tbody>
</table>`;
}

export const SUPABASE_EXAMPLES: { name: string; about: string; usage: SupabaseUsage }[] = [
  { name: 'Side project', about: '1,000 monthly users, 300 MB database, 3 GB egress', usage: { plan: 'free', compute: 'micro', dbGb: 0.3, egressGb: 3, mau: 1000, storageGb: 0.5, realtimePeak: 20, realtimeMessages: 100_000, edgeInvocations: 50_000 } },
  { name: 'Growing SaaS', about: '20,000 monthly users, 6 GB database, 120 GB egress, 40 GB files', usage: { plan: 'pro', compute: 'micro', dbGb: 6, egressGb: 120, mau: 20_000, storageGb: 40, realtimePeak: 300, realtimeMessages: 3e6, edgeInvocations: 1e6 } },
  { name: 'Busy app', about: '150,000 monthly users, 30 GB database, 600 GB egress, 300 GB files, Small compute', usage: { plan: 'pro', compute: 'small', dbGb: 30, egressGb: 600, mau: 150_000, storageGb: 300, realtimePeak: 1500, realtimeMessages: 20e6, edgeInvocations: 8e6 } },
];

function supabaseExamplesHtml(): string {
  return SUPABASE_EXAMPLES.map(({ name, about, usage }) => {
    const bill = supabaseBill(usage);
    const charged = bill.lines.filter((l) => l.costUsd > 0);
    const detail = usage.plan === 'free'
      ? (bill.freeIssues.length ? `Over the Free limits: ${bill.freeIssues.join('; ')}.` : 'Fits inside every Free plan limit.')
      : charged.map((l) => `${esc(l.label)}: ${usd(Math.round(l.costUsd * 100) / 100)}`).join(' · ');
    return `<div class="bg-surface border border-line rounded-2xl shadow-card p-5">
<h3 class="font-semibold">${esc(name)} — ${usd(Math.round(bill.totalUsd * 100) / 100)} a month on ${usage.plan === 'free' ? 'Free' : 'Pro'}</h3>
<p class="text-sm text-muted mt-1">${esc(about)}.</p>
<p class="text-sm mt-2">${detail}</p>
</div>`;
  }).join('\n');
}

/** Fill every build-time placeholder in a page. Used by the Vite HTML transform and by /llms-full.txt. */
export function fillPlaceholders(html: string): string {
  return html
    .replaceAll('{{SITE}}', SITE)
    .replaceAll('{{PLAN_COUNT}}', String(PLAN_COUNT))
    .replaceAll('{{VERIFIED_COUNT}}', String(VERIFIED_COUNT))
    .replaceAll('{{AI_MODEL_COUNT}}', String(AI_MODELS.length))
    .replace('<!--PRICING_SOURCES-->', () => sourcesTableHtml())
    .replace('<!--SUPABASE_PRICING_TABLE-->', () => supabasePricingTableHtml())
    .replace('<!--SUPABASE_COMPUTE_TABLE-->', () => supabaseComputeTableHtml())
    .replace('<!--SUPABASE_EXAMPLES-->', () => supabaseExamplesHtml());
}
