import type { Answers, AiUse, Feature, ProjectType } from './types';

export const PROJECT_INFO: Record<ProjectType, { title: string; desc: string }> = {
  ai_saas: { title: 'AI SaaS Application', desc: 'Subscription software with AI features' },
  ai_agent: { title: 'AI Agent / Automation', desc: 'Agents that use tools and run workflows' },
  ecommerce: { title: 'E-commerce Platform', desc: 'Online store with catalogue and checkout' },
  website: { title: 'Business Website', desc: 'Company site, landing pages, blog' },
  mobile: { title: 'Mobile Application', desc: 'iOS / Android app with a backend' },
  social: { title: 'Social Media Platform', desc: 'Profiles, feeds, media and chat' },
  marketplace: { title: 'Marketplace', desc: 'Buyers and sellers, listings, payouts' },
  dashboard: { title: 'Dashboard / Admin Panel', desc: 'Internal tools and reporting' },
  api: { title: 'API / Backend Service', desc: 'An API consumed by other apps' },
  custom: { title: 'Custom Project', desc: 'Something else — pick features yourself' },
};

export const FEATURE_INFO: Record<Feature, string> = {
  auth: 'Authentication',
  user_dashboard: 'User Dashboard',
  admin_dashboard: 'Admin Dashboard',
  payments: 'Payment Gateway',
  subscriptions: 'Subscription Management',
  ai_chatbot: 'AI Chatbot',
  ai_agents: 'AI Agents',
  file_uploads: 'File Uploads',
  media: 'Image / Video Processing',
  email: 'Email Notifications',
  sms: 'SMS / OTP',
  realtime: 'Real-time Notifications',
  search: 'Search',
  analytics: 'Analytics',
  third_party_api: 'Third-party API Integration',
  mcp: 'MCP Integrations',
};

const HIDDEN: Partial<Record<ProjectType, Feature[]>> = {
  website: ['user_dashboard', 'subscriptions', 'ai_agents', 'realtime', 'sms', 'mcp'],
  dashboard: ['payments', 'subscriptions'],
  api: ['user_dashboard', 'admin_dashboard', 'file_uploads', 'media'],
  ecommerce: ['mcp'],
};

export const DEFAULT_FEATURES: Record<ProjectType, Feature[]> = {
  ai_saas: ['auth', 'user_dashboard', 'payments', 'subscriptions', 'ai_chatbot', 'email', 'analytics'],
  ai_agent: ['auth', 'ai_agents', 'mcp', 'third_party_api', 'email'],
  ecommerce: ['auth', 'payments', 'admin_dashboard', 'file_uploads', 'email', 'search', 'analytics'],
  website: ['email', 'analytics'],
  mobile: ['auth', 'sms', 'realtime', 'file_uploads', 'analytics'],
  social: ['auth', 'file_uploads', 'media', 'realtime', 'search', 'email'],
  marketplace: ['auth', 'payments', 'user_dashboard', 'admin_dashboard', 'file_uploads', 'search', 'email'],
  dashboard: ['auth', 'admin_dashboard', 'analytics'],
  api: ['auth', 'analytics'],
  custom: [],
};

export function visibleFeatures(type: ProjectType | null): Feature[] {
  const hidden = type ? HIDDEN[type] ?? [] : [];
  return (Object.keys(FEATURE_INFO) as Feature[]).filter((f) => !hidden.includes(f));
}

export const USER_INFO: Record<Answers['users'], string> = {
  testing: 'Testing / Personal', '100-500': '100–500', '500-5k': '500–5,000', '5k-25k': '5,000–25,000',
  '25k-100k': '25,000–100,000', '100k-500k': '100,000–500,000', '500k+': 'Above 500,000',
};
export const FREQUENCY_INFO: Record<Answers['frequency'], { title: string; desc: string }> = {
  occasional: { title: 'Occasional', desc: 'A few visits a month' },
  regular: { title: 'Regular', desc: 'A couple of times a week' },
  frequent: { title: 'Frequent', desc: 'Most days' },
  heavy: { title: 'Heavy / Business critical', desc: 'Many times a day' },
};
export const GEO_INFO: Record<Answers['geography'], string> = { india: 'India', usa: 'USA', europe: 'Europe', apac: 'Asia-Pacific', worldwide: 'Worldwide' };
export const GROWTH_INFO: Record<Answers['growth'], { title: string; factor: number }> = {
  slow: { title: 'Slow', factor: 1.5 }, moderate: { title: 'Moderate', factor: 3 }, rapid: { title: 'Rapid', factor: 10 }, unsure: { title: 'Not sure', factor: 3 },
};
export const AI_USE_INFO: Record<AiUse, string> = {
  chatbot: 'AI Chatbot', content: 'Content Generation', agents: 'AI Agents', automation: 'Automation Workflows', multi: 'Multiple AI Models',
};
export const AI_LEVEL_INFO: Record<Answers['aiLevel'], { title: string; desc: string }> = {
  light: { title: 'Light', desc: '~15 AI requests per active user / month' },
  medium: { title: 'Medium', desc: '~60 AI requests per active user / month' },
  heavy: { title: 'Heavy', desc: '~250 AI requests per active user / month' },
  custom: { title: 'Custom', desc: 'Enter your own volumes' },
};
export const BUDGET_INFO: Record<Answers['budget'], { title: string; maxInr: number }> = {
  '<1k': { title: 'Under ₹1,000', maxInr: 1000 },
  '1k-5k': { title: '₹1,000–₹5,000', maxInr: 5000 },
  '5k-15k': { title: '₹5,000–₹15,000', maxInr: 15000 },
  '15k-50k': { title: '₹15,000–₹50,000', maxInr: 50000 },
  '50k-1L': { title: '₹50,000–₹1,00,000', maxInr: 100000 },
  '1L+': { title: 'Above ₹1,00,000', maxInr: Infinity },
  unsure: { title: 'Not sure', maxInr: Infinity },
};
export const PRIORITY_INFO: Record<Answers['priority'], { title: string; desc: string }> = {
  lowest: { title: 'Lowest cost', desc: 'Free tiers and minimal infrastructure' },
  performance: { title: 'Performance', desc: 'Fast responses, more headroom' },
  balanced: { title: 'Balanced', desc: 'Sensible trade-offs' },
  enterprise: { title: 'Enterprise reliability', desc: 'Redundancy and SLAs' },
};
export const PROVIDER_INFO: Record<Answers['provider'], string> = {
  none: 'No preference', aws: 'AWS', azure: 'Azure', gcp: 'Google Cloud', cloudflare: 'Cloudflare', vercel: 'Vercel', supabase: 'Supabase', other: 'Other',
};

export const DEFAULT_ANSWERS: Answers = {
  projectType: null,
  features: [],
  description: '',
  users: '500-5k',
  frequency: 'regular',
  geography: 'india',
  growth: 'moderate',
  aiUses: [],
  aiLevel: 'medium',
  aiCustom: { requestsPerMonth: 10000, inputTokens: 1500, outputTokens: 400 },
  models: [{ provider: 'auto', modelId: '', sharePct: 100, caching: true }],
  agent: { tools: 5, mcpServers: 2, toolCallsPerRequest: 3, execution: 'remote', concurrentSessions: 20, backgroundHoursPerDay: 0, thirdPartyFeesUsd: 0 },
  budget: 'unsure',
  priority: 'balanced',
  provider: 'none',
  currency: 'INR',
};

/** AI uses implied by the selected features (used to prefill step 3). */
export function aiUsesFromFeatures(features: Feature[], type: ProjectType | null): AiUse[] {
  const uses: AiUse[] = [];
  if (features.includes('ai_chatbot')) uses.push('chatbot');
  if (features.includes('ai_agents') || type === 'ai_agent') uses.push('agents');
  if (type === 'ai_saas' && uses.length === 0) uses.push('content');
  return uses;
}

// ---------- Local (offline) description extraction ----------

const TYPE_WORDS: [ProjectType, RegExp][] = [
  ['ai_agent', /\b(agent|agents|automation|automate|workflow)s?\b/i],
  ['ai_saas', /\b(ai|gpt|llm|chatbot)\b.*\b(saas|subscription|app)\b|\b(saas)\b.*\b(ai|gpt|llm)\b/i],
  ['ecommerce', /\b(e-?commerce|online store|shop|cart|checkout|products?)\b/i],
  ['marketplace', /\b(marketplace|buyers?|sellers?|vendors?)\b/i],
  ['social', /\b(social|feed|followers?|community|posts?)\b/i],
  ['mobile', /\b(mobile|android|ios|iphone|app store|play store)\b/i],
  ['dashboard', /\b(dashboard|admin panel|internal tool|reporting)\b/i],
  ['api', /\b(api|backend service|webhook)\b/i],
  ['website', /\b(website|landing page|blog|portfolio)\b/i],
];

const FEATURE_WORDS: [Feature, RegExp][] = [
  ['auth', /\b(login|log in|sign ?up|signin|sign in|auth|accounts?|users?)\b/i],
  ['user_dashboard', /\buser dashboard|my account|profile page\b/i],
  ['admin_dashboard', /\badmin\b/i],
  ['payments', /\b(payments?|pay|checkout|razorpay|stripe|upi)\b/i],
  ['subscriptions', /\b(subscriptions?|recurring|plans?|billing)\b/i],
  ['ai_chatbot', /\b(chatbot|chat bot|assistant|chat with)\b/i],
  ['ai_agents', /\bagents?\b/i],
  ['file_uploads', /\b(uploads?|files?|documents?|attachments?)\b/i],
  ['media', /\b(images?|photos?|videos?|media)\b/i],
  ['email', /\b(emails?|newsletter|notifications?)\b/i],
  ['sms', /\b(sms|otp|phone verification)\b/i],
  ['realtime', /\b(real-?time|live|chat|messaging|push notifications?)\b/i],
  ['search', /\bsearch\b/i],
  ['analytics', /\b(analytics|metrics|tracking|reports?)\b/i],
  ['third_party_api', /\b(integrations?|third[- ]party|api)\b/i],
  ['mcp', /\b(mcp|model context protocol|tools?)\b/i],
];

export interface Extraction {
  projectType: ProjectType | null;
  features: Feature[];
  source: 'claude' | 'local';
  users?: Answers['users'] | null;
  frequency?: Answers['frequency'] | null;
  geography?: Answers['geography'] | null;
  aiUses?: AiUse[];
  provider?: Answers['provider'] | null;
  notes?: string;
}

export function extractLocally(text: string): Extraction {
  const projectType = TYPE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  const features = FEATURE_WORDS.filter(([, re]) => re.test(text)).map(([f]) => f);
  return { projectType, features, source: 'local' };
}
