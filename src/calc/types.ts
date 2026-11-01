import { z } from 'zod';

export const PROJECT_TYPES = ['ai_saas', 'ai_agent', 'ecommerce', 'website', 'mobile', 'social', 'marketplace', 'dashboard', 'api', 'custom'] as const;
export const FEATURES = [
  'auth', 'user_dashboard', 'admin_dashboard', 'payments', 'subscriptions', 'ai_chatbot', 'ai_agents', 'file_uploads',
  'media', 'email', 'sms', 'realtime', 'search', 'analytics', 'third_party_api', 'mcp',
] as const;
export const USER_BANDS = ['testing', '100-500', '500-5k', '5k-25k', '25k-100k', '100k-500k', '500k+'] as const;
export const FREQUENCIES = ['occasional', 'regular', 'frequent', 'heavy'] as const;
export const GEOS = ['india', 'usa', 'europe', 'apac', 'worldwide'] as const;
export const GROWTH = ['slow', 'moderate', 'rapid', 'unsure'] as const;
export const AI_USES = ['chatbot', 'content', 'agents', 'automation', 'multi'] as const;
export const AI_LEVELS = ['light', 'medium', 'heavy', 'custom'] as const;
export const AI_PROVIDERS = ['auto', 'openai', 'anthropic', 'google', 'deepseek', 'other'] as const;
export const BUDGETS = ['<1k', '1k-5k', '5k-15k', '15k-50k', '50k-1L', '1L+', 'unsure'] as const;
export const PRIORITIES = ['lowest', 'performance', 'balanced', 'enterprise'] as const;
export const PROVIDER_PREFS = ['none', 'aws', 'azure', 'gcp', 'cloudflare', 'vercel', 'supabase', 'other'] as const;
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export const TIERS = ['budget', 'recommended', 'scalable'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type Feature = (typeof FEATURES)[number];
export type UserBand = (typeof USER_BANDS)[number];
export type Geo = (typeof GEOS)[number];
export type AiUse = (typeof AI_USES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Tier = (typeof TIERS)[number];

const num = z.number().finite().min(0);

export const ModelConfigSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  modelId: z.string().max(80), // '' = cheapest suitable model for the provider
  sharePct: num.max(100),
  caching: z.boolean(),
  // Only for provider 'other': user-entered USD per 1M tokens
  customInput: num.optional(),
  customOutput: num.optional(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const AgentSchema = z.object({
  tools: num.max(500),
  mcpServers: num.max(100),
  toolCallsPerRequest: num.max(100),
  execution: z.enum(['remote', 'local']),
  concurrentSessions: num.max(1_000_000),
  backgroundHoursPerDay: num.max(24),
  thirdPartyFeesUsd: num.max(1_000_000),
});

export const AnswersSchema = z.object({
  projectType: z.enum(PROJECT_TYPES).nullable(),
  features: z.array(z.enum(FEATURES)),
  description: z.string().max(2000),
  users: z.enum(USER_BANDS),
  frequency: z.enum(FREQUENCIES),
  geography: z.enum(GEOS),
  growth: z.enum(GROWTH),
  aiUses: z.array(z.enum(AI_USES)),
  aiLevel: z.enum(AI_LEVELS),
  aiCustom: z.object({ requestsPerMonth: num, inputTokens: num, outputTokens: num }),
  models: z.array(ModelConfigSchema).min(1).max(6),
  agent: AgentSchema,
  budget: z.enum(BUDGETS),
  priority: z.enum(PRIORITIES),
  provider: z.enum(PROVIDER_PREFS),
  currency: z.enum(CURRENCIES),
});
export type Answers = z.infer<typeof AnswersSchema>;

/** Editable workload assumptions (per-user rates). Derived totals live in `Derived`. */
export const WorkloadSchema = z.object({
  registeredUsers: num,
  activePct: num.max(100),
  sessionsPerMau: num,
  requestsPerSession: num,
  pageViewsPerSession: num,
  dbOpsPerRequest: num,
  kbPerResponse: num,
  mbPerPageView: num,
  fileStorageBaseGb: num,
  fileStorageMbPerUser: num,
  fileMbPerPageView: num,
  dbStorageMbPerUser: num,
  peakMultiplier: num.min(1),
  emailsPerMau: num,
  smsPerMau: num,
  searchesPerSession: num,
  eventsPerSession: num,
  errorRatePct: num.max(100),
  realtimeMsgsPerDau: num,
  aiRequestsPerMau: num,
  aiInputTokens: num,
  aiOutputTokens: num,
  aiCachedPct: num.max(100),
});
export type Workload = z.infer<typeof WorkloadSchema>;

export const AdvancedSchema = z.object({
  serviceOverrides: z.record(z.string(), z.string()), // slot -> catalogue entry id
  priceOverrides: z.record(z.string(), num), // `${entryId}:${meterKey|'base'}` -> USD unit price
  instanceOverride: num.max(500), // 0 = automatic
  disabledSlots: z.array(z.string()),
  extraSlots: z.array(z.enum(['cicd', 'cache'])),
});
export type Advanced = z.infer<typeof AdvancedSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string().max(120),
  savedAt: z.string(),
  answers: AnswersSchema,
  workloadOverrides: WorkloadSchema.partial(),
  advanced: AdvancedSchema,
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export type Slot =
  | 'frontend' | 'backend' | 'loadbalancer' | 'database' | 'cache' | 'storage' | 'auth' | 'ai' | 'email' | 'sms'
  | 'payments' | 'subscriptions' | 'realtime' | 'search' | 'media' | 'video' | 'analytics' | 'monitoring' | 'mcp'
  | 'cicd' | 'appstore' | 'domain';

export type Group = 'Frontend hosting' | 'Backend hosting' | 'Database' | 'Storage' | 'AI usage' | 'APIs' | 'MCP infrastructure' | 'Monitoring' | 'Other services';

export type PriceStatus = 'verified' | 'estimate' | 'user' | 'unavailable';

/** One billable row. All money is USD; the UI converts for display. */
export interface LineItem {
  label: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number;
  per: number;
  included: number;
  nativeCurrency: 'USD' | 'INR';
  nativeUnitPrice: number;
  period: 'month' | 'year' | 'one-time';
  monthlyUsd: number; // yearly fees spread /12; one-time = 0
  setupUsd: number; // one-time fees
  status: PriceStatus;
  formula: string;
}

export interface ServiceCost {
  slot: Slot;
  group: Group;
  entryId: string;
  provider: string;
  service: string;
  plan: string;
  region: string;
  purpose: string;
  why: string;
  usageSummary: string;
  sourceUrl: string;
  checked: string;
  lockIn: 'low' | 'medium' | 'high';
  alternatives: string[];
  notes: string[];
  warnings: string[];
  lines: LineItem[];
  monthlyUsd: number;
  setupUsd: number;
}

export interface Estimate {
  tier: Tier;
  services: ServiceCost[];
  monthlyUsd: number;
  annualUsd: number;
  setupUsd: number;
  perMauUsd: number;
  byGroup: Partial<Record<Group, number>>;
  warnings: string[];
}
