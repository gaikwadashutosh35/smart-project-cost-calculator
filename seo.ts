import 'dotenv/config'; // load .env before SITE_URL is read (imports run before module code)
import fs from 'node:fs';
import path from 'node:path';
import { AI_MODELS, CATALOG, FX_DATE, FX_SOURCE, USD_TO, byId } from './src/calc/catalog.ts';
import { COMPUTE, supabaseBill, type SupabaseUsage } from './src/calc/supabase.ts';
import { SB_NEON_SCENARIOS, compareRow } from './src/calc/compare.ts';

const PLAN_COUNT = CATALOG.length;
const VERIFIED_COUNT = CATALOG.filter((c) => c.status === 'verified').length;

/** Site identity. Set SITE_URL in .env once the domain is chosen; HTML uses {{SITE}} which the build replaces. */
export const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');
const SITE_CONFIGURED = Boolean(process.env.SITE_URL);

/** Security headers for every page. Express sets them in production; the build writes them to Netlify's _headers. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
};
export const BRAND = 'Smart Project Cost Calculator';

/** Every indexable page. `modified` must only change when the page content really changes (it feeds sitemap lastmod). */
export const PAGES = [
  { path: '/', file: 'index.html', title: 'SaaS and app hosting cost calculator', summary: 'What the calculator does, how it works, what it covers, FAQ.', modified: '2026-11-02' },
  { path: '/supabase-pricing-calculator/', file: 'supabase-pricing-calculator/index.html', title: 'Supabase pricing calculator', summary: 'Supabase Free and Pro quotas, overage rates and compute add-ons, with a calculator for your monthly bill.', modified: '2026-11-02' },
  { path: '/guides/supabase-vs-neon-pricing/', file: 'guides/supabase-vs-neon-pricing/index.html', title: 'Supabase vs Neon pricing', summary: 'Plan-by-plan comparison and monthly totals at four usage levels, with authentication included on both.', modified: '2026-11-02' },
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
- Is Neon cheaper than Supabase? For small or idle databases and at high user counts, usually yes; for an always-on mid-size app they are close. See ${SITE}/guides/supabase-vs-neon-pricing/

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

// Unit prices below $1 keep every published digit ($0.125, $0.00325); larger amounts show cents.
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: n < 1 ? 5 : 2 })}`;
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

// ---------- Supabase vs Neon guide (generated from the catalogue) ----------

function sbNeonGlanceHtml(): string {
  const sp = byId('supabase-pro');
  const nl = byId('neon-launch');
  const nf = byId('neon-free').limits!;
  const sf = byId('supabase-free').limits!;
  const rows: [string, string, string][] = [
    ['Monthly minimum', `${usd(sp.base)} per organisation, Micro compute included`, '$0 — pay only for what you use'],
    ['Compute', `Fixed instance, always on. Small adds $5, Medium $50, Large $100 a month`, `${usd(nl.meters[0].price)} per CU-hour; scales to zero when idle`],
    ['Database storage', `${sp.meters[0].included} GB included, then ${usd(sp.meters[0].price)} per GB`, `${usd(nl.meters[1].price)} per GB-month from the first GB`],
    ['Egress', `${sp.meters[1].included} GB included, then ${usd(sp.meters[1].price)} per GB`, `${nl.meters[2].included} GB per project included, then ${usd(nl.meters[2].price)} per GB`],
    ['Authentication', `${num(sbMeter('supabase-auth-pro').included!)} MAU included, then ${usd(sbMeter('supabase-auth-pro').price)} per MAU`, `Up to ${num(byId('neon-auth-launch').limits!.mau!)} MAU per project, no separate charge`],
    ['Branches', '$0.01344 per branch-hour', '10 per project included, then $1.50 per branch-month'],
    ['Free plan', `${sf.dbStorageGb! * 1000} MB database, ${sf.dbEgressGb} GB egress, ${num(byId('supabase-auth-free').limits!.mau!)} MAU; paused after 1 week of inactivity`, `${nf.dbStorageGb} GB and ${nf.cuHours} CU-hours per project, ${nf.dbEgressGb} GB egress, ${num(byId('neon-auth-free').limits!.mau!)} MAU; compute suspends when a limit runs out`],
  ];
  const td = 'px-4 py-2.5 align-top';
  return `<table class="w-full text-sm">
<thead><tr class="text-left text-muted border-b border-line"><th class="${td} font-medium"></th><th class="${td} font-medium">Supabase Pro</th><th class="${td} font-medium">Neon Launch</th></tr></thead>
<tbody>
${rows.map((r) => `<tr class="border-b border-line/60">${r.map((c, i) => `<td class="${td}${i === 0 ? ' font-medium' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>`;
}

function sbNeonScenariosHtml(): string {
  const money2 = (n: number) => usd(Math.round(n * 100) / 100);
  const parts = (lines: { label: string; costUsd: number }[]) =>
    lines.filter((l) => l.costUsd > 0).map((l) => `${esc(l.label.replace(/ \(net of \$10 compute credit\)/, ''))} ${money2(l.costUsd)}`).join(' · ');
  const td = 'px-4 py-3 align-top';
  return `<table class="w-full text-sm">
<thead><tr class="text-left text-muted border-b border-line"><th class="${td} font-medium">Scenario</th><th class="${td} font-medium">Supabase Pro</th><th class="${td} font-medium">Neon Launch</th></tr></thead>
<tbody>
${SB_NEON_SCENARIOS.map((s) => {
  const r = compareRow(s);
  const cheaper = r.neon.totalUsd < r.supabase.totalUsd ? 'neon' : 'supabase';
  const cell = (who: 'supabase' | 'neon', total: number, detail: string, free: boolean) =>
    `<td class="${td}"><b class="text-base${cheaper === who ? ' text-primary' : ''}">${money2(total)}</b>${cheaper === who ? ' <span class="text-xs font-semibold text-primary">cheaper</span>' : ''}<span class="block text-xs text-muted mt-1">${detail}</span>${free ? '<span class="block text-xs mt-1">The Free plan also fits.</span>' : ''}</td>`;
  return `<tr class="border-b border-line/60"><td class="${td}"><b>${esc(s.name)}</b><span class="block text-xs text-muted mt-1">${num(s.mau)} monthly active users · ${s.dbGb} GB database · ${s.egressGb} GB egress</span></td>${
    cell('supabase', r.supabase.totalUsd, parts(r.supabase.lines), r.supabaseFreeFits)}${
    cell('neon', r.neon.totalUsd, `${s.neonCu} CU × ${s.neonHours} h = ${num(r.cuHours)} CU-hours · ${parts(r.neon.lines)} · auth included`, r.neonFreeFits)}</tr>`;
}).join('\n')}
</tbody>
</table>`;
}

/** Netlify _headers file. Until SITE_URL is set, every page is noindex so a placeholder domain never gets indexed. */
export function netlifyHeaders(): string {
  const all = { ...SECURITY_HEADERS, ...(SITE_CONFIGURED ? {} : { 'X-Robots-Tag': 'noindex' }) };
  return `/*\n${Object.entries(all).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n# Vite gives built assets content-hashed names, so they never change in place\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
}

/** Write the files Express would otherwise serve, for static hosting (Netlify). Runs after `vite build`. */
export function writeStaticSeoFiles(outDir: string): void {
  const files: Record<string, string> = {
    'robots.txt': robotsTxt(),
    'sitemap.xml': sitemapXml(),
    'llms.txt': llmsTxt(),
    'llms-full.txt': llmsFullTxt(outDir),
    _headers: netlifyHeaders(),
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), text);
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
    .replace('<!--SUPABASE_EXAMPLES-->', () => supabaseExamplesHtml())
    .replace('<!--SB_NEON_GLANCE-->', () => sbNeonGlanceHtml())
    .replace('<!--SB_NEON_SCENARIOS-->', () => sbNeonScenariosHtml());
}
