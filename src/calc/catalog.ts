import type { Geo, PriceStatus, Slot } from './types';

/**
 * Pricing catalogue. Every number was read from the linked official page on `checked`
 * unless status is 'estimate'. Prices are USD unless `currency` says otherwise.
 * Update this file when providers change pricing; the engine reads nothing else.
 */

export const CHECKED = '2026-11-01';

export type UsageKey =
  | 'cdnRequests' | 'frontendEgressGb' | 'apiEgressGb' | 'fileEgressGb' | 'requests' | 'instances' | 'instanceHours'
  | 'vcpuHours' | 'memGbHours' | 'vcpuSeconds' | 'memGbSeconds' | 'lambdaGbSeconds' | 'cpuMs' | 'activeCpuHours'
  | 'fluidMemGbHours' | 'albHours' | 'lcuHours' | 'dbStorageGb' | 'dbEgressGb' | 'dbReads' | 'dbWrites' | 'cuHours'
  | 'cacheCommands' | 'fileStorageGb' | 'storageClassA' | 'storageClassB' | 'mau' | 'emails' | 'sms'
  | 'realtimeConnections' | 'realtimeMessages' | 'searches' | 'searchRecords' | 'mediaCredits' | 'videoMinStored'
  | 'videoMinDelivered' | 'events' | 'pageViews' | 'errors' | 'mcpEgressGb' | 'mcpRequests' | 'backgroundHours'
  | 'peakDbQps' | 'ciMinutes' | 'seats';

export interface Tier { upTo: number; price: number }

export interface Meter {
  key: UsageKey;
  label: string;
  unit: string;
  price: number; // per `per` units, in entry currency
  per?: number;
  included?: number;
  tiers?: Tier[]; // graduated by default; quantity thresholds are absolute
  tierMode?: 'graduated' | 'volume';
  byGeo?: Partial<Record<Geo, number>>;
  status?: PriceStatus;
  note?: string;
}

export interface CatalogEntry {
  id: string;
  slot: Slot;
  provider: string;
  service: string;
  plan: string;
  region: string;
  currency?: 'USD' | 'INR';
  base: number;
  period?: 'month' | 'year' | 'one-time';
  meters: Meter[];
  sourceUrl: string;
  checked: string;
  status: PriceStatus;
  /** false = not allowed or not suitable for commercial production (only offered for testing). */
  production?: boolean;
  /** Hard plan caps. Exceeding any makes the plan ineligible. */
  limits?: Partial<Record<UsageKey, number>>;
  /** Only valid when the database slot uses this provider. */
  requiresDb?: string;
  /** Only valid with these database plans (e.g. Neon Free auth only with the Neon Free database). */
  requiresDbEntry?: string[];
  /** Instance-based compute: sizing assumption used to compute instance count. */
  instance?: { capacityRps: number; vcpu?: number; memGb?: number };
  /** If any of these entries is also selected, the base fee is already paid there. */
  sharedBaseWith?: string[];
  lockIn: 'low' | 'medium' | 'high';
  alternatives: string[];
  notes?: string[];
}

const V = CHECKED;
const FLY_EGRESS: Partial<Record<Geo, number>> = { usa: 0.02, europe: 0.02, apac: 0.04, india: 0.12, worldwide: 0.04 };
const FLY_PRICING = 'https://fly.io/docs/about/pricing/';
const AWS_DT = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-east-1/index.json';
const awsEgress = (key: UsageKey): Meter => ({ key, label: 'Data transfer out', unit: 'GB', price: 0.09, included: 100, note: '100 GB/month free is shared across all AWS services; applied here per service.' });
const SB = 'https://supabase.com/pricing';
const VERCEL = 'https://vercel.com/pricing';

export const CATALOG: CatalogEntry[] = [
  // ---------- Frontend hosting ----------
  {
    id: 'cf-pages', slot: 'frontend', provider: 'Cloudflare', service: 'Pages', plan: 'Free', region: 'Global edge',
    base: 0, meters: [], sourceUrl: 'https://pages.cloudflare.com/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Vercel', 'Netlify', 'Firebase Hosting'],
    notes: ['Unlimited sites, requests and bandwidth on all plans.', 'Commercial use on the free plan is not explicitly stated on the pricing page — confirm in Cloudflare terms.'],
  },
  {
    id: 'vercel-hobby', slot: 'frontend', provider: 'Vercel', service: 'Hosting', plan: 'Hobby', region: 'Global edge',
    base: 0, meters: [], production: false, limits: { cdnRequests: 1_000_000, frontendEgressGb: 100 },
    sourceUrl: VERCEL, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Cloudflare Pages', 'Netlify'],
    notes: ['Hobby is for personal, non-commercial use only. Hard caps; no paid overage.'],
  },
  ...([
    ['vercel-pro', 0, 1_000_000, 1000],
    ['vercel-pro-cdn20', 20, 10_000_000, 50_000],
    ['vercel-pro-cdn100', 100, 50_000_000, 50_000],
    ['vercel-pro-cdn300', 300, 150_000_000, 50_000],
  ] as const).map(([id, cdnFee, req, gb]): CatalogEntry => ({
    id, slot: 'frontend', provider: 'Vercel', service: 'Hosting', plan: cdnFee ? `Pro + $${cdnFee} Flat Rate CDN tier` : 'Pro (1 developer seat)',
    region: 'Global edge', base: 20 + cdnFee, meters: [], limits: { cdnRequests: req, frontendEgressGb: gb },
    sourceUrl: 'https://vercel.com/docs/pricing/flat-rate-cdn', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Cloudflare Pages', 'Netlify', 'AWS Amplify'],
    notes: [`Flat Rate CDN tier covers ${req / 1e6}M CDN requests + ${gb / 1000} TB transfer per month.`, 'Pro includes $20/month usage credit (not deducted here — conservative).'],
  })),
  {
    id: 'aws-s3-static', slot: 'frontend', provider: 'AWS', service: 'S3 static website', plan: 'Pay as you go', region: 'us-east-1',
    base: 0, meters: [awsEgress('frontendEgressGb')], sourceUrl: AWS_DT, checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['AWS Amplify Hosting', 'CloudFront + S3', 'Cloudflare Pages'],
    notes: ['Storage for a static site is a few cents and omitted. Add CloudFront for HTTPS on a custom domain (CloudFront pricing not modeled).'],
  },
  {
    id: 'azure-swa-free', slot: 'frontend', provider: 'Azure', service: 'Static Web Apps', plan: 'Free', region: 'Global',
    base: 0, meters: [], limits: { frontendEgressGb: 100 }, sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/app-service/static/',
    checked: V, status: 'verified', lockIn: 'low', alternatives: ['Cloudflare Pages', 'Vercel'], notes: ['No SLA. Site stops serving if the 100 GB quota is exceeded.'],
  },
  {
    id: 'azure-swa-std', slot: 'frontend', provider: 'Azure', service: 'Static Web Apps', plan: 'Standard', region: 'Global',
    base: 9, meters: [{ key: 'frontendEgressGb', label: 'Bandwidth', unit: 'GB', price: 0.2, included: 100 }],
    sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/app-service/static/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Cloudflare Pages', 'Vercel'], notes: ['Includes SLA.'],
  },
  {
    id: 'firebase-spark', slot: 'frontend', provider: 'Google Firebase', service: 'Hosting', plan: 'Spark (free)', region: 'Global',
    base: 0, meters: [], limits: { frontendEgressGb: 10.8 }, sourceUrl: 'https://firebase.google.com/pricing', checked: V, status: 'verified',
    lockIn: 'low', alternatives: ['Cloudflare Pages', 'Vercel'], notes: ['360 MB/day transfer (~10.8 GB/month).'],
  },
  {
    id: 'firebase-blaze', slot: 'frontend', provider: 'Google Firebase', service: 'Hosting', plan: 'Blaze (pay as you go)', region: 'Global',
    base: 0, meters: [{ key: 'frontendEgressGb', label: 'Data transfer', unit: 'GB', price: 0.15, included: 10.8 }],
    sourceUrl: 'https://firebase.google.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Cloudflare Pages', 'Vercel'],
  },

  // ---------- Backend hosting ----------
  {
    id: 'cf-workers-free', slot: 'backend', provider: 'Cloudflare', service: 'Workers', plan: 'Free', region: 'Global edge',
    base: 0, meters: [], limits: { requests: 3_000_000 }, sourceUrl: 'https://developers.cloudflare.com/workers/platform/pricing/',
    checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Vercel Functions', 'AWS Lambda', 'Render'],
    notes: ['100,000 requests/day, 10 ms CPU per request.'],
  },
  {
    id: 'cf-workers-paid', slot: 'backend', provider: 'Cloudflare', service: 'Workers', plan: 'Paid', region: 'Global edge',
    base: 5, meters: [
      { key: 'requests', label: 'Requests', unit: 'requests', price: 0.3, per: 1e6, included: 10e6 },
      { key: 'cpuMs', label: 'CPU time', unit: 'CPU-ms', price: 0.02, per: 1e6, included: 30e6 },
    ],
    sourceUrl: 'https://developers.cloudflare.com/workers/platform/pricing/', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Vercel Functions', 'AWS Lambda', 'Render'], notes: ['No egress/bandwidth charges.'],
  },
  {
    id: 'vercel-functions', slot: 'backend', provider: 'Vercel', service: 'Functions (Fluid compute)', plan: 'Pro usage', region: 'iad1 (default)',
    base: 0, meters: [
      { key: 'requests', label: 'Function invocations', unit: 'invocations', price: 0.6, per: 1e6, included: 1e6, status: 'estimate', note: 'Included invocations on Pro not shown on pricing page; 1M assumed.' },
      { key: 'activeCpuHours', label: 'Active CPU', unit: 'hours', price: 0.128 },
      { key: 'fluidMemGbHours', label: 'Provisioned memory', unit: 'GB-hours', price: 0.0106 },
    ],
    sourceUrl: VERCEL, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Cloudflare Workers', 'AWS Lambda'],
    notes: ['Requires the Vercel Pro plan (billed under Frontend).'],
  },
  ...([
    ['render-512', 7, 'Web service 0.5 CPU / 512 MB', 15],
    ['render-2gb', 25, 'Web service 1 CPU / 2 GB', 60],
  ] as const).map(([id, price, plan, rps]): CatalogEntry => ({
    id, slot: 'backend', provider: 'Render', service: 'Node.js web service', plan, region: 'Oregon / Frankfurt / Singapore',
    base: 0, meters: [
      { key: 'instances', label: 'Instances', unit: 'instance-month', price },
      { key: 'apiEgressGb', label: 'Bandwidth', unit: 'GB', price: 0.15, included: 5, note: 'Hobby workspace includes 5 GB.' },
    ],
    instance: { capacityRps: rps }, sourceUrl: 'https://render.com/pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Railway', 'Fly.io', 'Koyeb'], notes: [`Sizing assumption: ~${rps} req/s per instance for a typical Node.js JSON API.`],
  })),
  ...([
    ['fly-shared-1gb', 6.7, 'shared-cpu-1x / 1 GB', 25],
    ['fly-perf-2gb', 33, 'performance-1x / 2 GB', 100],
  ] as const).map(([id, price, plan, rps]): CatalogEntry => ({
    id, slot: 'backend', provider: 'Fly.io', service: 'Machines (Node.js)', plan, region: 'iad / ewr (cheapest)',
    base: 0, meters: [
      { key: 'instances', label: 'Machines', unit: 'machine-month', price },
      { key: 'apiEgressGb', label: 'Outbound bandwidth', unit: 'GB', price: 0.02, byGeo: FLY_EGRESS },
    ],
    instance: { capacityRps: rps }, sourceUrl: FLY_PRICING, checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Render', 'Railway', 'Google Cloud Run'], notes: [`Sizing assumption: ~${rps} req/s per machine. Autoscaling via fly-proxy.`],
  })),
  ...([
    ['aws-ec2-t4g-small', 0.0168, 't4g.small (2 vCPU, 2 GB)', 30],
    ['aws-ec2-m7g-large', 0.0816, 'm7g.large (2 vCPU, 8 GB)', 120],
  ] as const).map(([id, price, plan, rps]): CatalogEntry => ({
    id, slot: 'backend', provider: 'AWS', service: 'EC2', plan, region: 'us-east-1',
    base: 0, meters: [{ key: 'instanceHours', label: 'Instance hours', unit: 'hours', price }, awsEgress('apiEgressGb')],
    instance: { capacityRps: rps }, sourceUrl: 'https://aws.amazon.com/ec2/pricing/on-demand/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['AWS Fargate', 'Fly.io', 'Render'], notes: [`Sizing assumption: ~${rps} req/s per instance.`],
  })),
  {
    id: 'aws-fargate', slot: 'backend', provider: 'AWS', service: 'ECS Fargate (ARM)', plan: '0.5 vCPU / 1 GB tasks', region: 'us-east-1',
    base: 0, meters: [
      { key: 'vcpuHours', label: 'vCPU hours', unit: 'vCPU-hours', price: 0.03238 },
      { key: 'memGbHours', label: 'Memory', unit: 'GB-hours', price: 0.00356 },
      awsEgress('apiEgressGb'),
    ],
    instance: { capacityRps: 20, vcpu: 0.5, memGb: 1 }, sourceUrl: 'https://aws.amazon.com/fargate/pricing/', checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Google Cloud Run', 'Azure Container Apps', 'Fly.io'], notes: ['Sizing assumption: ~20 req/s per task.'],
  },
  {
    id: 'aws-lambda', slot: 'backend', provider: 'AWS', service: 'Lambda', plan: 'Pay per request (x86)', region: 'us-east-1',
    base: 0, meters: [
      { key: 'requests', label: 'Requests', unit: 'requests', price: 0.2, per: 1e6, included: 1e6 },
      { key: 'lambdaGbSeconds', label: 'Compute', unit: 'GB-seconds', price: 0.0000166667, included: 400_000 },
      awsEgress('apiEgressGb'),
    ],
    sourceUrl: 'https://aws.amazon.com/lambda/pricing/', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Cloudflare Workers', 'Google Cloud Run'], notes: ['API Gateway charges not modeled (use a Lambda Function URL).'],
  },
  {
    id: 'aws-alb', slot: 'loadbalancer', provider: 'AWS', service: 'Application Load Balancer', plan: 'On-demand', region: 'us-east-1',
    base: 0, meters: [
      { key: 'albHours', label: 'Load balancer hours', unit: 'hours', price: 0.0225 },
      { key: 'lcuHours', label: 'Capacity units', unit: 'LCU-hours', price: 0.008 },
    ],
    sourceUrl: 'https://aws.amazon.com/elasticloadbalancing/pricing/', checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Platform load balancing (Fly.io, Render)'],
  },
  {
    id: 'gcp-cloud-run', slot: 'backend', provider: 'Google Cloud', service: 'Cloud Run', plan: 'Request-based billing', region: 'us-central1 (Tier 1)',
    base: 0, meters: [
      { key: 'requests', label: 'Requests', unit: 'requests', price: 0.4, per: 1e6, included: 2e6 },
      { key: 'vcpuSeconds', label: 'vCPU time', unit: 'vCPU-seconds', price: 0.000024, included: 180_000 },
      { key: 'memGbSeconds', label: 'Memory', unit: 'GiB-seconds', price: 0.0000025, included: 360_000 },
      { key: 'apiEgressGb', label: 'Internet egress', unit: 'GB', price: 0.12, included: 1, status: 'estimate', note: 'Premium tier egress rate not verified.' },
    ],
    sourceUrl: 'https://cloud.google.com/run/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['AWS Fargate', 'Azure Container Apps', 'Fly.io'],
  },
  {
    id: 'azure-container-apps', slot: 'backend', provider: 'Azure', service: 'Container Apps', plan: 'Consumption', region: 'East US',
    base: 0, meters: [
      { key: 'requests', label: 'Requests', unit: 'requests', price: 0.4, per: 1e6, included: 2e6 },
      { key: 'vcpuSeconds', label: 'vCPU time', unit: 'vCPU-seconds', price: 0.000024, included: 180_000 },
      { key: 'memGbSeconds', label: 'Memory', unit: 'GiB-seconds', price: 0.000003, included: 360_000 },
      { key: 'apiEgressGb', label: 'Internet egress', unit: 'GB', price: 0.087, included: 100, status: 'estimate', note: 'Azure bandwidth rate not verified.' },
    ],
    sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/container-apps/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Google Cloud Run', 'AWS Fargate'],
  },
  {
    id: 'azure-app-service-b1', slot: 'backend', provider: 'Azure', service: 'App Service (Linux)', plan: 'Basic B1', region: 'East US',
    base: 0, meters: [{ key: 'instances', label: 'Instances', unit: 'instance-month', price: 12.41 }],
    instance: { capacityRps: 25 }, sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/app-service/linux/', checked: V, status: 'verified',
    lockIn: 'low', alternatives: ['Azure Container Apps'], notes: ['Sizing assumption: ~25 req/s per instance.'],
  },

  // ---------- Database ----------
  {
    id: 'supabase-free', slot: 'database', provider: 'Supabase', service: 'PostgreSQL', plan: 'Free', region: 'Choose nearest (e.g. ap-south-1)',
    base: 0, meters: [], production: false, limits: { dbStorageGb: 0.5, dbEgressGb: 5, peakDbQps: 50 },
    sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Neon', 'Firebase'],
    notes: ['Projects pause after 1 week of inactivity — fine for testing only.'],
  },
  ...([
    ['supabase-pro', 'Pro (Micro compute)', 0, 150],
    ['supabase-pro-small', 'Pro + Small compute', 5, 300],
    ['supabase-pro-medium', 'Pro + Medium compute', 50, 700],
    ['supabase-pro-large', 'Pro + Large compute (2 vCPU dedicated)', 100, 1500],
  ] as const).map(([id, plan, extra, qps]): CatalogEntry => ({
    id, slot: 'database', provider: 'Supabase', service: 'PostgreSQL', plan, region: 'Choose nearest (e.g. ap-south-1)',
    base: 25 + extra, meters: [
      { key: 'dbStorageGb', label: 'Database disk', unit: 'GB', price: 0.125, included: 8 },
      { key: 'dbEgressGb', label: 'Egress', unit: 'GB', price: 0.09, included: 250 },
    ],
    limits: { peakDbQps: qps }, sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Neon', 'AWS RDS', 'Railway Postgres'],
    notes: [extra ? `Compute add-on net of the $10 Pro compute credit.` : 'Micro compute is covered by the $10 Pro compute credit.', `Sizing assumption: up to ~${qps} queries/s at peak.`, 'Daily backups (7 days) included.'],
  })),
  {
    id: 'neon-free', slot: 'database', provider: 'Neon', service: 'Serverless PostgreSQL', plan: 'Free', region: 'AWS / Azure regions',
    base: 0, meters: [], limits: { dbStorageGb: 1, cuHours: 100, dbEgressGb: 5 }, sourceUrl: 'https://neon.com/pricing', checked: V,
    status: 'verified', lockIn: 'low', alternatives: ['Supabase', 'AWS RDS'], notes: ['Scales to zero; no inactivity pausing. Compute suspends if limits are hit.'],
  },
  {
    id: 'neon-launch', slot: 'database', provider: 'Neon', service: 'Serverless PostgreSQL', plan: 'Launch (usage-based)', region: 'AWS / Azure regions',
    base: 0, meters: [
      { key: 'cuHours', label: 'Compute', unit: 'CU-hours', price: 0.106 },
      { key: 'dbStorageGb', label: 'Storage', unit: 'GB-month', price: 0.35 },
      { key: 'dbEgressGb', label: 'Egress', unit: 'GB', price: 0.1, included: 500 },
    ],
    sourceUrl: 'https://neon.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Supabase', 'AWS RDS'],
  },
  {
    id: 'mongodb-m0', slot: 'database', provider: 'MongoDB Atlas', service: 'MongoDB', plan: 'Free (M0)', region: 'AWS / GCP / Azure',
    base: 0, meters: [], production: false, limits: { dbStorageGb: 0.5, peakDbQps: 100 }, sourceUrl: 'https://www.mongodb.com/pricing',
    checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Supabase', 'DynamoDB'], notes: ['No backups.'],
  },
  {
    id: 'mongodb-flex', slot: 'database', provider: 'MongoDB Atlas', service: 'MongoDB', plan: 'Flex', region: 'AWS / GCP / Azure',
    base: 0, meters: [{ key: 'instanceHours', label: 'Cluster hours', unit: 'hours', price: 0.011, note: 'Capped at $30/month.' }],
    limits: { dbStorageGb: 5, peakDbQps: 500 }, sourceUrl: 'https://www.mongodb.com/pricing', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Supabase', 'DynamoDB'],
  },
  {
    id: 'mongodb-m10', slot: 'database', provider: 'MongoDB Atlas', service: 'MongoDB', plan: 'Dedicated (entry tier, M10)', region: 'AWS / GCP / Azure',
    base: 56.94, meters: [], limits: { peakDbQps: 1000 }, sourceUrl: 'https://www.mongodb.com/pricing', checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Supabase', 'DynamoDB'], notes: ['"Dedicated starts at $56.94/month"; M10 label inferred. Backups and transfer extra.'],
  },
  {
    id: 'dynamodb', slot: 'database', provider: 'AWS', service: 'DynamoDB', plan: 'On-demand', region: 'us-east-1',
    base: 0, meters: [
      { key: 'dbWrites', label: 'Write request units', unit: 'WRU', price: 0.625, per: 1e6 },
      { key: 'dbReads', label: 'Read request units', unit: 'RRU', price: 0.125, per: 1e6 },
      { key: 'dbStorageGb', label: 'Storage', unit: 'GB-month', price: 0.25, included: 25 },
    ],
    sourceUrl: 'https://aws.amazon.com/dynamodb/pricing/on-demand/', checked: V, status: 'verified', lockIn: 'high',
    alternatives: ['MongoDB Atlas', 'Supabase'], notes: ['NoSQL — requires designing access patterns up front.'],
  },
  {
    id: 'aws-rds-micro', slot: 'database', provider: 'AWS', service: 'RDS for PostgreSQL', plan: 'db.t4g.micro Single-AZ', region: 'us-east-1',
    base: 0, meters: [
      { key: 'instanceHours', label: 'Instance hours', unit: 'hours', price: 0.016 },
      { key: 'dbStorageGb', label: 'gp3 storage', unit: 'GB-month', price: 0.115 },
    ],
    limits: { peakDbQps: 100 }, sourceUrl: 'https://aws.amazon.com/rds/postgresql/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Supabase', 'Neon'], notes: ['Sizing assumption: up to ~100 queries/s. Automated backups up to DB size are free.'],
  },
  {
    id: 'aws-rds-medium-maz', slot: 'database', provider: 'AWS', service: 'RDS for PostgreSQL', plan: 'db.t4g.medium Multi-AZ', region: 'us-east-1',
    base: 0, meters: [
      { key: 'instanceHours', label: 'Instance hours', unit: 'hours', price: 0.129 },
      { key: 'dbStorageGb', label: 'gp3 storage (Multi-AZ)', unit: 'GB-month', price: 0.23 },
    ],
    limits: { peakDbQps: 500 }, sourceUrl: 'https://aws.amazon.com/rds/postgresql/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Aurora Serverless v2', 'Supabase'], notes: ['Standby replica in a second AZ for automatic failover.'],
  },
  ...([
    ['gcp-cloudsql-f1', 'db-f1-micro (shared core)', 0.0105, 60],
    ['gcp-cloudsql-g1', 'db-g1-small (shared core)', 0.035, 200],
  ] as const).map(([id, plan, price, qps]): CatalogEntry => ({
    id, slot: 'database', provider: 'Google Cloud', service: 'Cloud SQL for PostgreSQL', plan, region: 'us-central1',
    base: 0, meters: [
      { key: 'instanceHours', label: 'Instance hours', unit: 'hours', price },
      { key: 'dbStorageGb', label: 'SSD storage', unit: 'GB-month', price: 0.17 },
    ],
    limits: { peakDbQps: qps }, sourceUrl: 'https://cloud.google.com/sql/pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Supabase', 'Neon'], notes: ['Shared-core instances have no SLA.'],
  })),
  {
    id: 'azure-pg-b1ms', slot: 'database', provider: 'Azure', service: 'Database for PostgreSQL Flexible Server', plan: 'Burstable B1ms', region: 'East US',
    base: 0, meters: [
      { key: 'instanceHours', label: 'Instance hours', unit: 'hours', price: 0.017 },
      { key: 'dbStorageGb', label: 'Storage', unit: 'GB-month', price: 0.115 },
    ],
    limits: { peakDbQps: 100 }, sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/', checked: V,
    status: 'verified', lockIn: 'low', alternatives: ['Supabase', 'Neon'],
  },

  // ---------- Cache ----------
  {
    id: 'upstash-free', slot: 'cache', provider: 'Upstash', service: 'Redis', plan: 'Free', region: 'Global',
    base: 0, meters: [], limits: { cacheCommands: 500_000 }, sourceUrl: 'https://upstash.com/pricing/redis', checked: V, status: 'verified',
    lockIn: 'low', alternatives: ['Redis Cloud', 'AWS ElastiCache'],
  },
  {
    id: 'upstash-payg', slot: 'cache', provider: 'Upstash', service: 'Redis', plan: 'Pay as you go', region: 'Global',
    base: 0, meters: [{ key: 'cacheCommands', label: 'Commands', unit: 'commands', price: 0.2, per: 100_000 }],
    sourceUrl: 'https://upstash.com/pricing/redis', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Upstash Fixed 250 MB ($10/mo)', 'AWS ElastiCache'],
  },
  {
    id: 'aws-elasticache-micro', slot: 'cache', provider: 'AWS', service: 'ElastiCache (Valkey)', plan: 'cache.t4g.micro', region: 'us-east-1',
    base: 0, meters: [{ key: 'instanceHours', label: 'Node hours', unit: 'hours', price: 0.0128 }],
    sourceUrl: 'https://aws.amazon.com/elasticache/pricing/', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Upstash Redis'],
  },

  // ---------- File storage ----------
  {
    id: 'cf-r2', slot: 'storage', provider: 'Cloudflare', service: 'R2 object storage', plan: 'Standard', region: 'Automatic',
    base: 0, meters: [
      { key: 'fileStorageGb', label: 'Storage', unit: 'GB-month', price: 0.015, included: 10 },
      { key: 'storageClassA', label: 'Class A ops (writes)', unit: 'ops', price: 4.5, per: 1e6, included: 1e6 },
      { key: 'storageClassB', label: 'Class B ops (reads)', unit: 'ops', price: 0.36, per: 1e6, included: 10e6 },
    ],
    sourceUrl: 'https://developers.cloudflare.com/r2/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['AWS S3', 'Supabase Storage', 'Backblaze B2'], notes: ['Zero egress fees.'],
  },
  {
    id: 'aws-s3', slot: 'storage', provider: 'AWS', service: 'S3', plan: 'Standard', region: 'us-east-1',
    base: 0, meters: [{ key: 'fileStorageGb', label: 'Storage', unit: 'GB-month', price: 0.023 }, awsEgress('fileEgressGb')],
    sourceUrl: 'https://aws.amazon.com/s3/pricing/', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Cloudflare R2'],
    notes: ['Request charges (a few cents per 100k) omitted.'],
  },
  {
    id: 'gcs', slot: 'storage', provider: 'Google Cloud', service: 'Cloud Storage', plan: 'Standard', region: 'us-central1',
    base: 0, meters: [
      { key: 'fileStorageGb', label: 'Storage', unit: 'GB-month', price: 0.02 },
      { key: 'fileEgressGb', label: 'Internet egress', unit: 'GB', price: 0.12, included: 1 },
    ],
    sourceUrl: 'https://cloud.google.com/storage/pricing', checked: V, status: 'estimate', lockIn: 'low', alternatives: ['Cloudflare R2'],
    notes: ['Rates not re-verified for this release.'],
  },
  {
    id: 'azure-blob', slot: 'storage', provider: 'Azure', service: 'Blob Storage', plan: 'Hot LRS', region: 'East US',
    base: 0, meters: [
      { key: 'fileStorageGb', label: 'Storage', unit: 'GB-month', price: 0.018 },
      { key: 'fileEgressGb', label: 'Internet egress', unit: 'GB', price: 0.087, included: 100 },
    ],
    sourceUrl: 'https://azure.microsoft.com/en-us/pricing/details/storage/blobs/', checked: V, status: 'estimate', lockIn: 'low',
    alternatives: ['Cloudflare R2'], notes: ['Rates not re-verified for this release.'],
  },
  {
    id: 'supabase-storage-free', slot: 'storage', provider: 'Supabase', service: 'Storage', plan: 'Included in Free', region: 'Same as database',
    base: 0, meters: [], production: false, limits: { fileStorageGb: 1 }, requiresDb: 'Supabase', sourceUrl: SB, checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Cloudflare R2'],
  },
  {
    id: 'supabase-storage-pro', slot: 'storage', provider: 'Supabase', service: 'Storage', plan: 'Included in Pro', region: 'Same as database',
    base: 0, meters: [{ key: 'fileStorageGb', label: 'Storage', unit: 'GB-month', price: 0.0213, included: 100 }], requiresDb: 'Supabase',
    sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Cloudflare R2', 'AWS S3'],
    notes: ['File downloads count toward the Supabase egress allowance (billed on the database line).'],
  },

  // ---------- Authentication ----------
  {
    id: 'supabase-auth-free', slot: 'auth', provider: 'Supabase', service: 'Auth', plan: 'Included in Free', region: 'Same as database',
    base: 0, meters: [], production: false, limits: { mau: 50_000 }, requiresDb: 'Supabase', sourceUrl: SB, checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Clerk', 'Auth.js'],
  },
  {
    id: 'supabase-auth-pro', slot: 'auth', provider: 'Supabase', service: 'Auth', plan: 'Included in Pro', region: 'Same as database',
    base: 0, meters: [{ key: 'mau', label: 'Monthly active users', unit: 'MAU', price: 0.00325, included: 100_000 }], requiresDb: 'Supabase',
    sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Clerk', 'Auth.js'],
  },
  {
    id: 'clerk-hobby', slot: 'auth', provider: 'Clerk', service: 'Authentication', plan: 'Hobby (free)', region: 'Global',
    base: 0, meters: [], limits: { mau: 50_000 }, sourceUrl: 'https://clerk.com/pricing', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Supabase Auth', 'Auth.js', 'Firebase Auth'], notes: ['Billed by monthly retained users (MRU); MAU used as a conservative proxy.'],
  },
  {
    id: 'clerk-pro', slot: 'auth', provider: 'Clerk', service: 'Authentication', plan: 'Pro', region: 'Global',
    base: 25, meters: [{
      key: 'mau', label: 'Retained users', unit: 'MRU', price: 0.02, included: 50_000,
      tiers: [{ upTo: 100_000, price: 0.02 }, { upTo: 1e6, price: 0.018 }, { upTo: 1e7, price: 0.015 }, { upTo: Infinity, price: 0.012 }],
    }],
    sourceUrl: 'https://clerk.com/pricing', checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Supabase Auth', 'Auth.js'],
  },
  {
    id: 'firebase-auth', slot: 'auth', provider: 'Google Firebase', service: 'Authentication', plan: 'Blaze (Identity Platform)', region: 'Global',
    base: 0, meters: [{
      key: 'mau', label: 'Monthly active users', unit: 'MAU', price: 0.0055, included: 50_000,
      tiers: [{ upTo: 100_000, price: 0.0055 }, { upTo: 1e6, price: 0.0046 }, { upTo: 1e7, price: 0.0032 }, { upTo: Infinity, price: 0.0025 }],
    }],
    sourceUrl: 'https://cloud.google.com/identity-platform/pricing', checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Supabase Auth', 'Clerk'],
  },
  ...([['neon-auth-free', 'Included in Free', 60_000, 'neon-free'], ['neon-auth-launch', 'Included in Launch', 1_000_000, 'neon-launch']] as const).map(([id, plan, mau, db]): CatalogEntry => ({
    id, slot: 'auth', provider: 'Neon', service: 'Managed Better Auth', plan, region: 'Same as database',
    base: 0, meters: [], limits: { mau }, requiresDb: 'Neon', requiresDbEntry: [db], sourceUrl: 'https://neon.com/pricing', checked: '2026-11-02', status: 'verified',
    lockIn: 'low', alternatives: ['Clerk', 'Supabase Auth', 'Auth.js'], notes: [`No separate charge up to ${mau.toLocaleString('en-US')} MAU per project; higher limits on request.`],
  })),
  {
    id: 'aws-cognito', slot: 'auth', provider: 'AWS', service: 'Cognito user pools', plan: 'Lite', region: 'us-east-1',
    base: 0, meters: [{
      key: 'mau', label: 'Monthly active users', unit: 'MAU', price: 0.0055, included: 10_000,
      tiers: [{ upTo: 100_000, price: 0.0055 }, { upTo: 1e6, price: 0.0046 }, { upTo: 1e7, price: 0.00325 }, { upTo: Infinity, price: 0.0025 }],
    }],
    sourceUrl: 'https://aws.amazon.com/cognito/pricing/', checked: V, status: 'verified', lockIn: 'high', alternatives: ['Clerk', 'Supabase Auth'],
  },

  // ---------- Email ----------
  {
    id: 'resend-free', slot: 'email', provider: 'Resend', service: 'Transactional email', plan: 'Free', region: 'Global',
    base: 0, meters: [], limits: { emails: 3000 }, sourceUrl: 'https://resend.com/pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['AWS SES', 'Postmark', 'Brevo'], notes: ['Also limited to 100 emails/day.'],
  },
  ...([['resend-pro', 20, 50_000], ['resend-pro-100k', 35, 100_000]] as const).map(([id, base, inc]): CatalogEntry => ({
    id, slot: 'email', provider: 'Resend', service: 'Transactional email', plan: `Pro ${inc / 1000}k`, region: 'Global',
    base, meters: [{ key: 'emails', label: 'Emails', unit: 'emails', price: 0.9, per: 1000, included: inc }],
    sourceUrl: 'https://resend.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['AWS SES', 'Postmark'],
  })),
  {
    id: 'aws-ses', slot: 'email', provider: 'AWS', service: 'SES', plan: 'Pay as you go', region: 'us-east-1',
    base: 0, meters: [{ key: 'emails', label: 'Emails', unit: 'emails', price: 0.1, per: 1000 }],
    sourceUrl: 'https://aws.amazon.com/ses/pricing/', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Resend', 'Postmark'],
  },

  // ---------- SMS / OTP ----------
  {
    id: 'msg91', slot: 'sms', provider: 'MSG91', service: 'OTP SMS', plan: 'Prepaid packs', region: 'India', currency: 'INR',
    base: 0, meters: [{
      key: 'sms', label: 'OTP SMS', unit: 'SMS', price: 0.25, tierMode: 'volume',
      tiers: [{ upTo: 15_000, price: 0.25 }, { upTo: 27_000, price: 0.22 }, { upTo: 53_685, price: 0.2 }, { upTo: 855_556, price: 0.19 }, { upTo: Infinity, price: 0.18 }],
    }],
    sourceUrl: 'https://msg91.com/in/pricing/otp', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Twilio Verify', '2Factor', 'Firebase Phone Auth'],
    notes: ['Excludes 18% GST.'],
  },
  {
    id: 'twilio-verify', slot: 'sms', provider: 'Twilio', service: 'Verify (SMS OTP)', plan: 'Pay as you go', region: 'By destination',
    base: 0, meters: [
      { key: 'sms', label: 'Successful verifications', unit: 'verifications', price: 0.05 },
      { key: 'sms', label: 'SMS channel fee', unit: 'SMS', price: 0.0083, byGeo: { usa: 0.0083, india: 0.0832, europe: 0.05, apac: 0.05, worldwide: 0.05 }, note: 'US and India rates verified; Europe/APAC vary by country (~$0.05 estimate).' },
    ],
    sourceUrl: 'https://www.twilio.com/en-us/verify/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['MSG91', 'Vonage', 'Firebase Phone Auth'],
    notes: ['US carrier fees (~$0.003–0.005/SMS) not included.'],
  },

  // ---------- Payments (fees are % of revenue — not infrastructure) ----------
  {
    id: 'razorpay', slot: 'payments', provider: 'Razorpay', service: 'Payment gateway', plan: 'Standard', region: 'India',
    base: 0, meters: [], sourceUrl: 'https://razorpay.com/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Stripe India', 'Cashfree', 'PayU'], notes: ['2% per successful domestic transaction (+18% GST on fee); up to 3% international. Charged on revenue — not included in the infrastructure total.'],
  },
  {
    id: 'stripe-us', slot: 'payments', provider: 'Stripe', service: 'Payments', plan: 'Standard', region: 'United States',
    base: 0, meters: [], sourceUrl: 'https://stripe.com/us/pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Paddle', 'Lemon Squeezy', 'Adyen'], notes: ['2.9% + $0.30 per domestic card charge; +1.5% international. Charged on revenue — not included in the infrastructure total.'],
  },
  {
    id: 'stripe-in', slot: 'payments', provider: 'Stripe', service: 'Payments', plan: 'Standard (India)', region: 'India',
    base: 0, meters: [], sourceUrl: 'https://stripe.com/in/pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Razorpay'], notes: ['2% for Indian domestic cards; 3% international. Charged on revenue — not included.'],
  },
  {
    id: 'stripe-billing', slot: 'subscriptions', provider: 'Stripe', service: 'Billing', plan: 'Pay as you go', region: 'Global',
    base: 0, meters: [], sourceUrl: 'https://stripe.com/us/pricing', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Razorpay Subscriptions', 'Paddle', 'Chargebee'], notes: ['0.7% of billing volume. Charged on revenue — not included.'],
  },
  {
    id: 'razorpay-subscriptions', slot: 'subscriptions', provider: 'Razorpay', service: 'Subscriptions', plan: 'Standard', region: 'India',
    base: 0, meters: [], sourceUrl: 'https://razorpay.com/pricing/', checked: V, status: 'estimate', lockIn: 'medium',
    alternatives: ['Stripe Billing', 'Chargebee'], notes: ['Recurring charges use standard Razorpay fees; confirm any subscription surcharge with Razorpay.'],
  },

  // ---------- Realtime ----------
  {
    id: 'supabase-realtime-free', slot: 'realtime', provider: 'Supabase', service: 'Realtime', plan: 'Included in Free', region: 'Same as database',
    base: 0, meters: [], production: false, limits: { realtimeConnections: 200, realtimeMessages: 2e6 }, requiresDb: 'Supabase',
    sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Pusher', 'Ably'],
  },
  {
    id: 'supabase-realtime-pro', slot: 'realtime', provider: 'Supabase', service: 'Realtime', plan: 'Included in Pro', region: 'Same as database',
    base: 0, meters: [
      { key: 'realtimeConnections', label: 'Peak connections', unit: 'connections', price: 10, per: 1000, included: 500 },
      { key: 'realtimeMessages', label: 'Messages', unit: 'messages', price: 2.5, per: 1e6, included: 5e6 },
    ],
    requiresDb: 'Supabase', sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Pusher', 'Ably'],
  },
  {
    id: 'supabase-edge-free', slot: 'backend', provider: 'Supabase', service: 'Edge Functions', plan: 'Included in Free', region: 'Global edge',
    base: 0, meters: [], production: false, limits: { requests: 500_000 }, requiresDb: 'Supabase', sourceUrl: SB, checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Cloudflare Workers', 'Vercel Functions'],
  },
  {
    id: 'supabase-edge-pro', slot: 'backend', provider: 'Supabase', service: 'Edge Functions', plan: 'Included in Pro', region: 'Global edge',
    base: 0, meters: [{ key: 'requests', label: 'Invocations', unit: 'invocations', price: 2, per: 1e6, included: 2e6 }], requiresDb: 'Supabase',
    sourceUrl: SB, checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Cloudflare Workers', 'Vercel Functions'],
  },
  ...([
    ['pusher-sandbox', 'Sandbox', 0, 100, 6e6],
    ['pusher-startup', 'Startup', 49, 500, 30e6],
    ['pusher-pro', 'Pro', 99, 2000, 120e6],
  ] as const).map(([id, plan, base, conn, msgs]): CatalogEntry => ({
    id, slot: 'realtime', provider: 'Pusher', service: 'Channels', plan, region: 'Choose cluster',
    base, meters: [], limits: { realtimeConnections: conn, realtimeMessages: msgs },
    sourceUrl: 'https://pusher.com/channels/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Ably', 'Supabase Realtime', 'Socket.IO on your backend'],
    notes: [`${conn} concurrent connections, ${msgs / 30e6}M messages/day.`],
  })),

  // ---------- Search ----------
  {
    id: 'pg-fts', slot: 'search', provider: 'PostgreSQL', service: 'Full-text search', plan: 'Built into your database', region: 'Same as database',
    base: 0, meters: [], sourceUrl: 'https://www.postgresql.org/docs/current/textsearch.html', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Algolia', 'Meilisearch', 'Typesense'], notes: ['No extra cost; adds some database load.'],
  },
  {
    id: 'algolia-build', slot: 'search', provider: 'Algolia', service: 'Search', plan: 'Build (free)', region: 'Global',
    base: 0, meters: [], limits: { searches: 10_000, searchRecords: 50_000 }, sourceUrl: 'https://www.algolia.com/pricing', checked: V,
    status: 'verified', lockIn: 'medium', alternatives: ['Meilisearch', 'Typesense', 'Postgres full-text'],
  },
  {
    id: 'algolia-grow', slot: 'search', provider: 'Algolia', service: 'Search', plan: 'Grow', region: 'Global',
    base: 0, meters: [
      { key: 'searches', label: 'Search requests', unit: 'requests', price: 0.5, per: 1000, included: 10_000 },
      { key: 'searchRecords', label: 'Records', unit: 'records', price: 0.4, per: 1000, included: 100_000 },
    ],
    sourceUrl: 'https://www.algolia.com/pricing', checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Meilisearch', 'Typesense'],
  },
  {
    id: 'meilisearch-base', slot: 'search', provider: 'Meilisearch', service: 'Cloud', plan: 'Usage-based Base', region: 'Choose region',
    base: 30, meters: [], limits: { searches: 50_000, searchRecords: 100_000 }, sourceUrl: 'https://www.meilisearch.com/pricing', checked: V,
    status: 'verified', lockIn: 'low', alternatives: ['Algolia', 'Typesense'], notes: ['Overage rates are not published; larger plans need a quote.'],
  },

  // ---------- Media ----------
  ...([
    ['cloudinary-free', 'Free', 0, 25],
    ['cloudinary-plus', 'Plus', 99, 225],
    ['cloudinary-advanced', 'Advanced', 249, 600],
  ] as const).map(([id, plan, base, credits]): CatalogEntry => ({
    id, slot: 'media', provider: 'Cloudinary', service: 'Image & video processing', plan, region: 'Global CDN',
    base, meters: [], limits: { mediaCredits: credits }, sourceUrl: 'https://cloudinary.com/pricing', checked: V, status: 'verified',
    lockIn: 'medium', alternatives: ['Cloudflare Images', 'imgix', 'sharp on your backend'],
    notes: [`${credits} credits/month. 1 credit = 1 GB storage, 1 GB bandwidth or 1,000 transformations.`],
  })),
  {
    id: 'cf-stream', slot: 'video', provider: 'Cloudflare', service: 'Stream', plan: 'Pay as you go', region: 'Global',
    base: 0, meters: [
      { key: 'videoMinStored', label: 'Minutes stored', unit: 'minutes', price: 5, per: 1000 },
      { key: 'videoMinDelivered', label: 'Minutes delivered', unit: 'minutes', price: 1, per: 1000 },
    ],
    sourceUrl: 'https://developers.cloudflare.com/stream/pricing/', checked: V, status: 'verified', lockIn: 'medium', alternatives: ['Mux', 'Bunny Stream'],
  },

  // ---------- Analytics ----------
  {
    id: 'ga4', slot: 'analytics', provider: 'Google', service: 'Analytics 4', plan: 'Free', region: 'Global',
    base: 0, meters: [], sourceUrl: 'https://marketingplatform.google.com/about/analytics/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['PostHog', 'Plausible'], notes: ['Free; product analytics is limited.'],
  },
  {
    id: 'posthog', slot: 'analytics', provider: 'PostHog', service: 'Product analytics', plan: 'Usage-based', region: 'US / EU cloud',
    base: 0, meters: [{ key: 'events', label: 'Identified events', unit: 'events', price: 0.000198, included: 1e6, note: 'First paid tier; higher volumes get cheaper (not modeled).' }],
    sourceUrl: 'https://posthog.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Mixpanel', 'Plausible', 'GA4'],
  },
  {
    id: 'plausible', slot: 'analytics', provider: 'Plausible', service: 'Web analytics', plan: 'Starter', region: 'EU',
    base: 9, meters: [], limits: { pageViews: 10_000 }, sourceUrl: 'https://plausible.io/#pricing', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['PostHog', 'GA4'],
  },

  // ---------- Monitoring ----------
  {
    id: 'sentry-dev', slot: 'monitoring', provider: 'Sentry', service: 'Error monitoring', plan: 'Developer (free)', region: 'US / EU',
    base: 0, meters: [], limits: { errors: 5000 }, sourceUrl: 'https://sentry.io/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Better Stack', 'Highlight', 'Grafana Cloud'], notes: ['Single user.'],
  },
  {
    id: 'sentry-team', slot: 'monitoring', provider: 'Sentry', service: 'Error monitoring', plan: 'Team (monthly billing)', region: 'US / EU',
    base: 29, meters: [], limits: { errors: 50_000 }, sourceUrl: 'https://sentry.io/pricing/', checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Better Stack', 'Grafana Cloud'], notes: ['$26/month if billed annually.'],
  },

  // ---------- MCP infrastructure ----------
  {
    id: 'mcp-cf-workers', slot: 'mcp', provider: 'Cloudflare', service: 'Workers (remote MCP servers)', plan: 'Paid', region: 'Global edge',
    base: 5, sharedBaseWith: ['cf-workers-paid'], meters: [{ key: 'mcpRequests', label: 'Tool calls', unit: 'requests', price: 0.3, per: 1e6, included: 10e6 }],
    sourceUrl: 'https://developers.cloudflare.com/workers/platform/pricing/', checked: V, status: 'verified', lockIn: 'medium',
    alternatives: ['Fly.io Machines', 'Google Cloud Run'], notes: ['MCP protocol itself has no per-call fee. Included requests are shared with any other Workers on the account.'],
  },
  {
    id: 'mcp-fly', slot: 'mcp', provider: 'Fly.io', service: 'Machines (remote MCP servers)', plan: 'shared-cpu-1x / 1 GB', region: 'iad / ewr',
    base: 0, meters: [
      { key: 'instances', label: 'Always-on MCP machines', unit: 'machine-month', price: 6.7 },
      { key: 'backgroundHours', label: 'Background task machine', unit: 'hours', price: 6.7 / 730, note: 'Per-second billing; $6.70/month ÷ 730 h.' },
      { key: 'mcpEgressGb', label: 'Outbound bandwidth', unit: 'GB', price: 0.02, byGeo: FLY_EGRESS },
    ],
    instance: { capacityRps: 50 }, sourceUrl: FLY_PRICING, checked: V, status: 'verified', lockIn: 'low',
    alternatives: ['Cloudflare Workers', 'Google Cloud Run'], notes: ['MCP protocol itself has no per-call fee. Sizing: ~50 concurrent sessions per machine.'],
  },
  {
    id: 'mcp-local', slot: 'mcp', provider: 'Self', service: 'Local MCP servers', plan: 'Runs on user machines', region: 'Local',
    base: 0, meters: [], sourceUrl: 'https://modelcontextprotocol.io/', checked: V, status: 'verified', lockIn: 'low', alternatives: ['Remote MCP hosting'],
    notes: ['Local (stdio) servers run on the end user’s machine — no hosting cost.'],
  },

  // ---------- Developer services ----------
  {
    id: 'github-free', slot: 'cicd', provider: 'GitHub', service: 'Actions', plan: 'Free', region: 'Global',
    base: 0, meters: [{ key: 'ciMinutes', label: 'Linux minutes', unit: 'minutes', price: 0.006, included: 2000 }],
    sourceUrl: 'https://github.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['GitLab CI', 'CircleCI'],
  },
  {
    id: 'github-team', slot: 'cicd', provider: 'GitHub', service: 'Team + Actions', plan: 'Team', region: 'Global',
    base: 0, meters: [
      { key: 'seats', label: 'Users', unit: 'users', price: 4 },
      { key: 'ciMinutes', label: 'Linux minutes', unit: 'minutes', price: 0.006, included: 3000 },
    ],
    sourceUrl: 'https://github.com/pricing', checked: V, status: 'verified', lockIn: 'low', alternatives: ['GitLab', 'CircleCI'],
  },
  {
    id: 'apple-dev', slot: 'appstore', provider: 'Apple', service: 'Developer Program', plan: 'Annual membership', region: 'Global',
    base: 99, period: 'year', meters: [], sourceUrl: 'https://developer.apple.com/programs/enroll/', checked: V, status: 'verified',
    lockIn: 'high', alternatives: [], notes: ['Required to publish on the App Store.'],
  },
  {
    id: 'google-play', slot: 'appstore', provider: 'Google', service: 'Play Console', plan: 'One-time registration', region: 'Global',
    base: 25, period: 'one-time', meters: [], sourceUrl: 'https://support.google.com/googleplay/android-developer/answer/6112435', checked: V,
    status: 'verified', lockIn: 'high', alternatives: [], notes: ['Required to publish on Google Play.'],
  },
  {
    id: 'domain-com', slot: 'domain', provider: 'Cloudflare Registrar', service: 'Domain (.com)', plan: 'At-cost registration', region: 'Global',
    base: 10.46, period: 'year', meters: [], sourceUrl: 'https://www.cloudflare.com/products/registrar/', checked: V, status: 'estimate',
    lockIn: 'low', alternatives: ['Namecheap', 'Porkbun', 'GoDaddy'], notes: ['Price seen on a third-party mirror of Cloudflare at-cost pricing; confirm in the Cloudflare dashboard.'],
  },
];

export const byId = (id: string): CatalogEntry => {
  const e = CATALOG.find((c) => c.id === id);
  if (!e) throw new Error(`Unknown catalogue entry: ${id}`);
  return e;
};

// ---------- AI models (USD per 1M tokens, standard tier) ----------

export type ModelClass = 'economy' | 'standard' | 'premium';
export interface AiModel {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek';
  name: string;
  cls: ModelClass;
  input: number;
  cachedInput: number;
  output: number;
  sourceUrl: string;
  /** Scheduled price changes published on the pricing page. */
  changes?: { from: string; input: number; cachedInput: number; output: number }[];
  note?: string;
}

const OPENAI = 'https://developers.openai.com/api/docs/pricing';
const ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const GEMINI = 'https://ai.google.dev/gemini-api/docs/pricing';
const DEEPSEEK = 'https://api-docs.deepseek.com/quick_start/pricing';

export const AI_MODELS: AiModel[] = [
  { id: 'gpt-6-luna', provider: 'openai', name: 'GPT-6 Luna', cls: 'economy', input: 0.1, cachedInput: 0.01, output: 0.5, sourceUrl: OPENAI },
  { id: 'gpt-6.1-terra', provider: 'openai', name: 'GPT-6.1 Terra', cls: 'standard', input: 1, cachedInput: 0.05, output: 5, sourceUrl: OPENAI },
  { id: 'gpt-6-astra', provider: 'openai', name: 'GPT-6 Astra', cls: 'premium', input: 10, cachedInput: 1, output: 50, sourceUrl: OPENAI },
  { id: 'claude-haiku-5-5', provider: 'anthropic', name: 'Claude Haiku 5.5', cls: 'economy', input: 0.1, cachedInput: 0.01, output: 0.5, sourceUrl: ANTHROPIC, note: 'Prompts over 100k tokens cost 5×.' },
  { id: 'claude-sonnet-5-5', provider: 'anthropic', name: 'Claude Sonnet 5.5', cls: 'standard', input: 2, cachedInput: 0.1, output: 10, sourceUrl: ANTHROPIC },
  { id: 'claude-opus-5-5', provider: 'anthropic', name: 'Claude Opus 5.5', cls: 'premium', input: 4, cachedInput: 0.2, output: 20, sourceUrl: ANTHROPIC },
  { id: 'gemini-3.1-flash-lite', provider: 'google', name: 'Gemini 3.1 Flash-Lite', cls: 'economy', input: 0.25, cachedInput: 0.025, output: 1.5, sourceUrl: GEMINI },
  { id: 'gemini-3.5-flash-lite', provider: 'google', name: 'Gemini 3.5 Flash-Lite', cls: 'economy', input: 0.3, cachedInput: 0.03, output: 2.5, sourceUrl: GEMINI },
  {
    id: 'gemini-3.8-flash', provider: 'google', name: 'Gemini 3.8 Flash', cls: 'standard', input: 0.75, cachedInput: 0.075, output: 3.75, sourceUrl: GEMINI,
    changes: [{ from: '2027-01-01', input: 1.5, cachedInput: 0.15, output: 7.5 }],
  },
  {
    id: 'gemini-4-argon', provider: 'google', name: 'Gemini 4 Argon', cls: 'premium', input: 2, cachedInput: 0.1, output: 10, sourceUrl: GEMINI,
    changes: [{ from: '2026-12-01', input: 4, cachedInput: 0.2, output: 20 }],
  },
  { id: 'deepseek-flash', provider: 'deepseek', name: 'DeepSeek V4.1 Flash', cls: 'economy', input: 0.3, cachedInput: 0.006, output: 1.2, sourceUrl: DEEPSEEK, note: 'Peak-hour rates; off-peak is 50% cheaper.' },
  { id: 'deepseek-v4-pro', provider: 'deepseek', name: 'DeepSeek V4 Pro', cls: 'standard', input: 1.32, cachedInput: 0.044, output: 3.96, sourceUrl: DEEPSEEK, note: 'Peak-hour rates; off-peak is 50% cheaper.' },
];

/** Price in effect on a given date (YYYY-MM-DD). */
export function modelPrice(m: AiModel, asOf: string) {
  const change = (m.changes ?? []).filter((c) => c.from <= asOf).sort((a, b) => b.from.localeCompare(a.from))[0];
  return change ?? { input: m.input, cachedInput: m.cachedInput, output: m.output };
}

// ---------- Currency (ECB reference rates, 2026-10-30) ----------
export const FX_DATE = '2026-10-30';
export const FX_SOURCE = 'https://www.ecb.europa.eu/stats/eurofxref/';
export const USD_TO: Record<'USD' | 'INR' | 'EUR' | 'GBP', number> = { USD: 1, EUR: 1 / 1.1172, GBP: 0.8338 / 1.1172, INR: 106.084 / 1.1172 };
