import 'dotenv/config'; // load .env before SITE_URL is read (imports run before module code)
import fs from 'node:fs';
import path from 'node:path';
import { AI_MODELS, CATALOG, FX_DATE, FX_SOURCE, USD_TO } from './src/calc/catalog';

/** Site identity. Set SITE_URL in .env once the domain is chosen; HTML uses {{SITE}} which the build replaces. */
export const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');
export const BRAND = 'Smart Project Cost Calculator';

/** Every indexable page. `modified` must only change when the page content really changes (it feeds sitemap lastmod). */
export const PAGES = [
  { path: '/', file: 'index.html', title: 'SaaS and app hosting cost calculator', summary: 'What the calculator does, how it works, what it covers, FAQ.', modified: '2026-11-02' },
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

> A free web calculator that estimates what it costs to run a software project — hosting, database, storage, AI model usage, email, SMS, payments, monitoring and MCP servers. You describe the project, pick features, expected users and budget; it recommends three architectures (Budget, Recommended, Scalable) with monthly and annual costs. Prices come from 94 plans across more than 30 providers plus 12 AI models from 4 providers, each with its official pricing link and the date it was checked (2026-11-01). Estimates exclude taxes and payment-processing fees.

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

## Pages
${PAGES.map((p) => `- [${p.title}](${SITE}${p.path}): ${p.summary}`).join('\n')}
`;

/** Plain text of each indexable page, for /llms-full.txt. (The calculator is noindex: its content is rendered by JavaScript.) */
export function llmsFullTxt(htmlRoot: string): string {
  const blocks = PAGES.map((p) => {
    const html = fs.readFileSync(path.join(htmlRoot, p.file), 'utf8');
    const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? '';
    const text = main
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(h[1-6]|p|li|tr|dt|dd)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\{\{SITE\}\}/g, SITE)
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
