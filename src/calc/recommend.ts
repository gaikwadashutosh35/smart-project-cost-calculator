import { USD_TO } from './catalog';
import { BUDGET_INFO } from './questionnaire';
import type { Advanced, Answers, Estimate, Feature, Slot, Tier } from './types';
import type { Derived } from './workload';

/** A slot to fill and the plan family the engine may choose from (cheapest eligible plan wins). */
export interface Selection { slot: Slot; family: string[]; why: string; minInstances?: number }

export const PURPOSE: Record<Slot, string> = {
  frontend: 'Serves your website / web app to visitors',
  backend: 'Runs your server code and APIs',
  loadbalancer: 'Spreads traffic across multiple servers',
  database: 'Stores users, content and business data',
  cache: 'Keeps hot data in memory to cut database load',
  storage: 'Stores uploaded files and images',
  auth: 'Sign-up, login, sessions and password resets',
  ai: 'Large language model API calls',
  email: 'Sends verification, receipts and notification emails',
  sms: 'Sends one-time passwords by SMS',
  payments: 'Accepts payments from customers',
  subscriptions: 'Recurring billing and plan management',
  realtime: 'Pushes live updates and notifications to users',
  search: 'Lets users search your content',
  media: 'Resizes, optimizes and delivers images / video',
  video: 'Encodes and streams video',
  analytics: 'Tracks how people use your product',
  monitoring: 'Alerts you about errors and crashes',
  mcp: 'Hosts MCP servers that give AI agents tools',
  cicd: 'Builds, tests and deploys on every change',
  appstore: 'Publishing to app stores',
  domain: 'Your web address',
};

const SUPA_PRO = ['supabase-pro', 'supabase-pro-small', 'supabase-pro-medium', 'supabase-pro-large'];
const VERCEL_PRO = ['vercel-pro', 'vercel-pro-cdn20', 'vercel-pro-cdn100', 'vercel-pro-cdn300'];
const WEB_APPS = ['ai_saas', 'ecommerce', 'marketplace', 'social', 'dashboard'];

export const budgetMaxUsd = (a: Answers) => BUDGET_INFO[a.budget].maxInr / USD_TO.INR;

export function recommend(a: Answers, d: Derived, tier: Tier, adv: Advanced): Selection[] {
  const type = a.projectType ?? 'custom';
  const p = a.provider;
  const has = (f: Feature) => a.features.includes(f);
  const testing = a.users === 'testing';
  const ha = tier === 'scalable' && (d.registered >= 5000 || a.priority === 'enterprise');
  const tight = budgetMaxUsd(a) < 60;
  const out: Selection[] = [];
  const add = (slot: Slot, family: string[], why: string, minInstances?: number) => out.push({ slot, family, why, minInstances });

  // Frontend
  if (type === 'mobile') add('frontend', ['cf-pages'], 'A landing page for your app. The app itself ships through the app stores.');
  else if (type !== 'api') {
    if (p === 'aws') add('frontend', ['aws-s3-static'], 'You prefer AWS; static assets are served from S3.');
    else if (p === 'azure') add('frontend', tier === 'budget' ? ['azure-swa-free', 'azure-swa-std'] : ['azure-swa-std'], 'You prefer Azure; Static Web Apps is its managed frontend host.');
    else if (p === 'gcp') add('frontend', ['firebase-spark', 'firebase-blaze'], 'You prefer Google Cloud; Firebase Hosting is its managed frontend host.');
    else if (p === 'vercel' || (tier !== 'budget' && WEB_APPS.includes(type) && a.priority !== 'lowest' && !tight))
      add('frontend', testing && tier === 'budget' ? ['vercel-hobby', ...VERCEL_PRO] : VERCEL_PRO,
        'Best-in-class hosting for Next.js / React apps: server rendering, preview deployments and a global CDN. Pro is required for commercial use.');
    else add('frontend', ['cf-pages'], 'Free global hosting with unlimited bandwidth — the cheapest way to serve a frontend.');
  }

  // Backend
  const simpleSite = type === 'website' && !['auth', 'payments', 'subscriptions', 'user_dashboard', 'admin_dashboard', 'ai_chatbot', 'search', 'file_uploads'].some((f) => has(f as Feature));
  const frontendIsVercel = out.some((s) => s.slot === 'frontend' && s.family[0].startsWith('vercel'));
  if (simpleSite) add('backend', ['cf-workers-free', 'cf-workers-paid'], 'Only small serverless functions are needed (e.g. contact form).');
  else if (p === 'aws') {
    if (tier === 'budget' || (tier === 'recommended' && d.peakRps < 30)) add('backend', ['aws-lambda'], 'Pay-per-request functions: no idle cost at your traffic level.');
    else {
      add('backend', ['aws-fargate'], 'Containers with autoscaling for steady traffic.', ha ? 2 : 1);
      if (tier === 'scalable') add('loadbalancer', ['aws-alb'], 'Required in front of multiple Fargate tasks.');
    }
  } else if (p === 'gcp') add('backend', ['gcp-cloud-run'], 'Serverless containers that scale to zero and autoscale on demand.', ha ? 1 : undefined);
  else if (p === 'azure') add('backend', ['azure-container-apps'], 'Serverless containers with a monthly free grant and autoscaling.');
  else if (p === 'cloudflare') add('backend', tier === 'budget' ? ['cf-workers-free', 'cf-workers-paid'] : ['cf-workers-paid'], 'Edge functions with no egress fees; $5/month covers 10M requests.');
  else if (p === 'vercel' || (frontendIsVercel && tier !== 'scalable')) add('backend', ['vercel-functions'], 'API routes deploy with your frontend — no separate server to manage.');
  else if (tier === 'budget') add('backend', ['cf-workers-free', 'cf-workers-paid'], 'Serverless edge functions: free up to 100k requests/day.');
  else if (tier === 'recommended') add('backend', ['render-512', 'render-2gb'], 'An always-on Node.js server: simple to deploy, no cold starts, handles streaming AI responses.');
  else add('backend', ['fly-shared-1gb', 'fly-perf-2gb'], ha ? 'Autoscaling Node.js machines; 2 minimum for zero-downtime deploys and failover.' : 'Autoscaling Node.js machines close to your users.', ha ? 2 : 1);

  // Database
  const needsDb = !simpleSite;
  if (needsDb) {
    if (p === 'aws') add('database', tier === 'budget' ? ['aws-rds-micro'] : ha ? ['aws-rds-medium-maz'] : ['aws-rds-micro', 'aws-rds-medium-maz'],
      ha ? 'Managed PostgreSQL with a standby in a second availability zone.' : 'Managed PostgreSQL on AWS.');
    else if (p === 'gcp') add('database', ['gcp-cloudsql-f1', 'gcp-cloudsql-g1'], 'Managed PostgreSQL on Google Cloud.');
    else if (p === 'azure') add('database', ['azure-pg-b1ms'], 'Managed PostgreSQL on Azure.');
    else if (tier === 'budget' && testing) add('database', ['supabase-free', ...SUPA_PRO], 'Free PostgreSQL with auth and storage built in — ideal for testing.');
    else if (tier === 'budget' && p !== 'supabase') add('database', ['neon-free', 'neon-launch'], 'Serverless PostgreSQL that scales to zero, so you only pay for active time.');
    else add('database', SUPA_PRO, 'PostgreSQL plus auth, file storage and realtime in one $25/month plan — less to wire up and maintain.');
  }
  const dbIsSupabase = out.some((s) => s.slot === 'database' && s.family[0].startsWith('supabase'));

  if ((tier === 'scalable' && (d.peakRps >= 20 || d.registered >= 25000)) || adv.extraSlots.includes('cache'))
    add('cache', p === 'aws' ? ['aws-elasticache-micro'] : ['upstash-free', 'upstash-payg'], 'Your peak traffic justifies caching hot reads to keep database load and latency down.');

  if (d.fileStorageGb > 0) {
    if (p === 'aws') add('storage', ['aws-s3'], 'Object storage for uploads on AWS.');
    else if (p === 'gcp') add('storage', ['gcs'], 'Object storage for uploads on Google Cloud.');
    else if (p === 'azure') add('storage', ['azure-blob'], 'Object storage for uploads on Azure.');
    else if (dbIsSupabase && tier !== 'scalable') add('storage', ['supabase-storage-free', 'supabase-storage-pro'], 'Included with your Supabase plan (100 GB on Pro) and uses the same permissions as your database.');
    else add('storage', ['cf-r2'], 'Cheap object storage with zero download (egress) fees — matters as file traffic grows.');
  }

  if (has('auth') || has('user_dashboard') || has('subscriptions')) {
    if (dbIsSupabase) add('auth', ['supabase-auth-free', 'supabase-auth-pro'], 'Included with Supabase (100k MAU on Pro) and tied directly to your database rows.');
    else if (out.some((s) => s.slot === 'database' && s.family[0].startsWith('neon')))
      add('auth', ['neon-auth-free', 'neon-auth-launch'], 'Included with Neon (Managed Better Auth): no separate charge up to 60k MAU on Free and 1M on paid plans.');
    else if (p === 'aws') add('auth', ['aws-cognito'], 'Managed user pools on AWS; 10k MAU free.');
    else if (p === 'gcp') add('auth', ['firebase-auth'], 'Firebase Auth; 50k MAU free.');
    else add('auth', ['clerk-hobby', 'clerk-pro'], 'Drop-in sign-in UI and user management; free up to 50k monthly users.');
  }

  if (a.aiUses.length) add('ai', [], 'You selected AI features. Cost depends on tokens per request and the model.');

  if (has('email') || has('auth')) {
    if (p === 'aws' || (tier !== 'budget' && d.emails > 100_000)) add('email', ['aws-ses'], d.emails > 100_000 ? 'At your email volume SES costs a fraction of other providers.' : 'Email sending on AWS.');
    else add('email', ['resend-free', 'resend-pro', 'resend-pro-100k'], 'Reliable transactional email with a simple API; free up to 3,000 emails/month.');
  }
  if (has('sms')) add('sms', a.geography === 'india' ? ['msg91'] : ['twilio-verify'], a.geography === 'india' ? 'DLT-compliant OTP SMS in India at ~₹0.18–0.25 per SMS.' : 'Managed OTP verification with fraud protection.');
  if (has('payments') || type === 'ecommerce' || type === 'marketplace')
    add('payments', [a.geography === 'india' ? 'razorpay' : 'stripe-us'], a.geography === 'india' ? 'UPI, cards and netbanking for Indian customers.' : 'Global card payments with a great developer experience.');
  if (has('subscriptions')) add('subscriptions', [a.geography === 'india' ? 'razorpay-subscriptions' : 'stripe-billing'], 'Handles recurring plans, renewals and failed payments.');
  if (has('realtime') || type === 'social')
    add('realtime', dbIsSupabase ? ['supabase-realtime-free', 'supabase-realtime-pro'] : ['pusher-sandbox', 'pusher-startup', 'pusher-pro'],
      dbIsSupabase ? 'Included with Supabase; pushes database changes live to clients.' : 'Managed WebSockets so you don’t run your own socket servers.');
  if (has('search')) {
    const algolia = tier === 'scalable' || (tier === 'recommended' && a.priority === 'performance');
    add('search', algolia ? ['algolia-build', 'algolia-grow'] : ['pg-fts'],
      algolia ? 'Typo-tolerant, instant search that scales independently of your database.' : 'PostgreSQL full-text search is free and good enough for most apps.');
  }
  if (has('media')) {
    add('media', ['cloudinary-free', 'cloudinary-plus', 'cloudinary-advanced'], 'On-the-fly image resizing and optimization without running your own processing servers.');
    if (type === 'social') add('video', ['cf-stream'], 'Video encoding and adaptive streaming billed per minute.');
  }
  if (has('analytics')) add('analytics', tier === 'budget' ? ['ga4'] : ['posthog'], tier === 'budget' ? 'Free traffic analytics.' : 'Product analytics (funnels, retention); first 1M events/month free.');
  if (!(type === 'website' && tier === 'budget'))
    add('monitoring', tier === 'budget' ? ['sentry-dev'] : ha ? ['sentry-team'] : ['sentry-dev', 'sentry-team'], 'Know about errors before your users report them.');
  if (d.usesMcp) {
    const remote = a.agent.execution === 'remote';
    add('mcp', !remote ? ['mcp-local'] : a.agent.backgroundHoursPerDay > 0 || (tier === 'scalable' && a.agent.concurrentSessions > 50) ? ['mcp-fly'] : ['mcp-cf-workers'],
      remote ? 'Your agents call tools through remote MCP servers that need hosting.' : 'MCP servers run locally next to the agent.');
  }
  if (adv.extraSlots.includes('cicd')) add('cicd', ['github-free', 'github-team'], 'Automated build, test and deploy.');
  if (type === 'mobile') {
    add('appstore', ['apple-dev'], 'Required to publish on the Apple App Store.');
    add('appstore', ['google-play'], 'Required to publish on Google Play.');
  }
  add('domain', ['domain-com'], 'A custom domain for your product.');

  return out
    .filter((s) => !adv.disabledSlots.includes(s.slot))
    .map((s) => (adv.serviceOverrides[s.slot] && s.slot !== 'ai' && s.slot !== 'appstore' ? { ...s, family: [adv.serviceOverrides[s.slot]], why: `${s.why} (Provider chosen in advanced mode.)` } : s));
}

export const TIER_INFO: Record<Tier, { title: string; tagline: string }> = {
  budget: { title: 'Budget', tagline: 'Lowest practical cost' },
  recommended: { title: 'Recommended', tagline: 'Best balance of cost, performance and effort' },
  scalable: { title: 'Scalable', tagline: 'Ready for growing workloads' },
};

/** Advantages, limitations and upgrade notes derived from the actual estimate. */
export function narrative(e: Estimate) {
  const free = e.services.filter((s) => s.monthlyUsd === 0 && /free|hobby|sandbox|build|developer|spark/i.test(s.plan)).map((s) => `${s.provider} ${s.service}`);
  const lockHigh = e.services.filter((s) => s.lockIn !== 'low').map((s) => s.provider);
  const adv: string[] = [];
  const lim: string[] = [];
  const up: string[] = [];
  if (e.tier === 'budget') {
    adv.push('Lowest monthly bill', 'Managed services — no servers to patch');
    if (free.length) adv.push(`Free tiers: ${[...new Set(free)].join(', ')}`);
    lim.push('Free plans have hard caps and usually no SLA', 'Limited support');
    up.push('Move to the Recommended setup once you have paying users or hit a free-tier cap');
  } else if (e.tier === 'recommended') {
    adv.push('Production-ready paid plans with support', 'Simple stack that a small team can run');
    lim.push('Single-instance services — brief downtime possible during incidents');
    up.push('Add caching and more instances when peak traffic grows', 'Turn on point-in-time recovery for the database when data becomes critical');
  } else {
    adv.push('Autoscaling and headroom for traffic spikes', 'Paid monitoring with higher error quotas');
    lim.push('Higher fixed cost — only worth it with real traffic', 'More moving parts to operate');
    up.push('Consider reserved / committed-use pricing once usage is steady (typically 20–50% cheaper)');
  }
  if (lockHigh.length) lim.push(`Vendor lock-in to watch: ${[...new Set(lockHigh)].join(', ')}`);
  return { advantages: adv, limitations: lim, upgrades: up };
}

/** Pick the architecture to highlight given priority and budget. */
export function chooseTier(a: Answers, estimates: Record<Tier, Estimate>): { tier: Tier; reason: string } {
  const preferred: Tier = a.priority === 'lowest' ? 'budget' : a.priority === 'enterprise' ? 'scalable' : 'recommended';
  const max = budgetMaxUsd(a);
  if (estimates[preferred].monthlyUsd <= max) return { tier: preferred, reason: `Matches your “${a.priority}” priority and fits your budget.` };
  const order: Tier[] = ['scalable', 'recommended', 'budget'];
  const fit = order.slice(order.indexOf(preferred)).find((t) => estimates[t].monthlyUsd <= max);
  if (fit) return { tier: fit, reason: `The ${TIER_INFO[preferred].title} option exceeds your budget, so the ${TIER_INFO[fit].title} option is highlighted.` };
  return { tier: 'budget', reason: 'Even the Budget option exceeds your stated budget — see the breakdown for the biggest costs.' };
}
