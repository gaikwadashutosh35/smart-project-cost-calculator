import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimate } from './engine';
import { decodeShare, encodeShare, toCsv } from './export';
import { DEFAULT_ANSWERS, DEFAULT_FEATURES, extractLocally } from './questionnaire';
import { chooseTier } from './recommend';
import { AnswersSchema, type Advanced, type Answers } from './types';
import { defaultWorkload } from './workload';

const ADV: Advanced = { serviceOverrides: {}, priceOverrides: {}, instanceOverride: 0, disabledSlots: [], extraSlots: [] };
const AS_OF = '2026-11-01';
const aiSaas: Answers = { ...DEFAULT_ANSWERS, projectType: 'ai_saas', features: DEFAULT_FEATURES.ai_saas, aiUses: ['chatbot'] };
const run = (a: Answers, tier: 'budget' | 'recommended' | 'scalable' = 'recommended', adv = ADV, w = defaultWorkload(a)) => estimate(a, w, tier, adv, AS_OF);
const slots = (a: Answers, tier?: 'budget' | 'recommended' | 'scalable') => run(a, tier).services.map((s) => s.entryId);

test('AI SaaS: questionnaire → workload → three priced architectures', () => {
  assert.ok(AnswersSchema.safeParse(aiSaas).success);
  const [b, r, s] = (['budget', 'recommended', 'scalable'] as const).map((t) => run(aiSaas, t));
  for (const e of [b, r, s]) {
    assert.ok(e.monthlyUsd > 0);
    assert.equal(e.annualUsd, e.monthlyUsd * 12);
    for (const svc of e.services) for (const l of svc.lines) assert.ok(Number.isFinite(l.monthlyUsd) && l.monthlyUsd >= 0, `${svc.entryId} ${l.label}`);
  }
  assert.ok(b.monthlyUsd <= r.monthlyUsd, 'budget should not cost more than recommended');
  const groups = Object.keys(r.byGroup);
  for (const g of ['Frontend hosting', 'Backend hosting', 'Database', 'AI usage', 'APIs']) assert.ok(groups.includes(g), g);
  assert.ok(r.services.some((x) => x.slot === 'payments' && x.monthlyUsd === 0), 'payment fees are % of revenue, not infra');
});

test('no AI selected → no AI cost', () => {
  const a: Answers = { ...DEFAULT_ANSWERS, projectType: 'ecommerce', features: DEFAULT_FEATURES.ecommerce };
  assert.ok(!run(a).services.some((s) => s.slot === 'ai'));
});

test('free plans are only used when they fit and are allowed for production', () => {
  const testing: Answers = { ...aiSaas, users: 'testing' };
  assert.ok(slots(testing, 'budget').includes('supabase-free'));
  assert.ok(!slots({ ...aiSaas, users: '5k-25k' }, 'budget').includes('supabase-free'), 'Supabase Free pauses — not for production');
  const big: Answers = { ...aiSaas, users: '100k-500k', frequency: 'heavy' };
  assert.ok(slots(big, 'budget').includes('clerk-pro'), 'Clerk Hobby caps at 50k MAU');
});

test('growth is not a straight multiplication', () => {
  const a = aiSaas;
  const at = (users: number) => run(a, 'recommended', ADV, { ...defaultWorkload(a), registeredUsers: users }).monthlyUsd;
  const small = at(100);
  const large = at(100_000);
  assert.ok(large > small);
  assert.ok(large / small < 1000, 'fixed fees and free tiers make scaling sub-linear');
});

test('provider preference and overrides drive the stack', () => {
  const aws = run({ ...aiSaas, provider: 'aws' }, 'recommended');
  for (const slot of ['frontend', 'backend', 'database'] as const) assert.equal(aws.services.find((s) => s.slot === slot)?.provider, 'AWS', slot);
  const overridden = run(aiSaas, 'recommended', { ...ADV, serviceOverrides: { database: 'neon-launch' }, priceOverrides: { 'neon-launch:Compute': 1 } });
  const db = overridden.services.find((s) => s.slot === 'database')!;
  assert.equal(db.entryId, 'neon-launch');
  assert.equal(db.lines.find((l) => l.label === 'Compute')!.status, 'user');
});

test('agents with local MCP have no hosting cost; unknown tool fees are flagged', () => {
  const a: Answers = { ...DEFAULT_ANSWERS, projectType: 'ai_agent', features: DEFAULT_FEATURES.ai_agent, aiUses: ['agents'], agent: { ...DEFAULT_ANSWERS.agent, execution: 'local' } };
  const mcp = run(a).services.find((s) => s.slot === 'mcp')!;
  assert.equal(mcp.entryId, 'mcp-local');
  assert.equal(mcp.monthlyUsd, 0);
  assert.ok(mcp.lines.some((l) => l.status === 'unavailable'));
});

test('MCP on Workers pays the $5 base unless the chosen backend plan is Workers Paid', () => {
  const a: Answers = { ...DEFAULT_ANSWERS, projectType: 'ai_agent', features: DEFAULT_FEATURES.ai_agent, aiUses: ['agents'] };
  const e = run(a, 'budget');
  assert.equal(e.services.find((s) => s.slot === 'backend')!.entryId, 'cf-workers-free');
  assert.ok(e.services.find((s) => s.slot === 'mcp')!.monthlyUsd >= 5);
});

test('budget drives which architecture is highlighted', () => {
  const tiers = { budget: run(aiSaas, 'budget'), recommended: run(aiSaas, 'recommended'), scalable: run(aiSaas, 'scalable') };
  assert.equal(chooseTier({ ...aiSaas, budget: 'unsure' }, tiers).tier, 'recommended');
  assert.equal(chooseTier({ ...aiSaas, priority: 'lowest' }, tiers).tier, 'budget');
});

test('exports: CSV rows and share-link round trip', () => {
  const e = run(aiSaas);
  const csv = toCsv(e, 'INR');
  assert.ok(csv.startsWith('Architecture,Category,Provider'));
  assert.ok(csv.includes('TOTAL'));
  const scenario = { id: 'x', name: 'Test', savedAt: AS_OF, answers: aiSaas, workloadOverrides: {}, advanced: ADV };
  assert.deepEqual(decodeShare(encodeShare(scenario)), scenario);
  assert.equal(decodeShare('not-valid'), null);
});

test('local description extraction', () => {
  const x = extractLocally('I want to create an AI-powered SaaS application with user subscriptions, chatbot, payment gateway, and admin dashboard.');
  assert.equal(x.projectType, 'ai_saas');
  for (const f of ['subscriptions', 'ai_chatbot', 'payments', 'admin_dashboard'] as const) assert.ok(x.features.includes(f), f);
});
