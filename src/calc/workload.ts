import type { Answers, ProjectType, UserBand, Workload } from './types';

export const REGISTERED: Record<UserBand, number> = {
  testing: 25, '100-500': 300, '500-5k': 2500, '5k-25k': 15000, '25k-100k': 60000, '100k-500k': 300000, '500k+': 750000,
};
const ACTIVE_PCT = { occasional: 25, regular: 40, frequent: 55, heavy: 70 };
const SESSIONS = { occasional: 4, regular: 10, frequent: 25, heavy: 50 };

// [requests/session, page views/session, MB/page view, KB/response, DB ops/request, DB MB/user, events/session]
const TYPE_PROFILE: Record<ProjectType, [number, number, number, number, number, number, number]> = {
  ai_saas: [25, 5, 1.2, 15, 3, 1, 15],
  ai_agent: [15, 3, 1, 10, 3, 1, 10],
  ecommerce: [20, 8, 2, 20, 3, 0.5, 20],
  website: [1, 4, 2, 5, 1, 0.05, 6],
  mobile: [25, 1, 1, 10, 3, 0.5, 20],
  social: [40, 10, 1.5, 20, 4, 2, 25],
  marketplace: [25, 8, 2, 20, 3, 0.5, 20],
  dashboard: [30, 6, 1, 25, 4, 0.5, 10],
  api: [50, 0, 0, 5, 2, 0.2, 0],
  custom: [20, 5, 1.5, 15, 3, 0.5, 15],
};

const AI_REQ_PER_MAU: Record<Answers['aiLevel'], number> = { light: 15, medium: 60, heavy: 250, custom: 0 };

/** Translate questionnaire answers into editable workload assumptions. */
export function defaultWorkload(a: Answers): Workload {
  const type = a.projectType ?? 'custom';
  const [reqPerSession, pvPerSession, mbPerPv, kbPerResp, dbOps, dbMb, events] = TYPE_PROFILE[type];
  const has = (f: Answers['features'][number]) => a.features.includes(f);
  const shop = type === 'ecommerce' || type === 'marketplace';

  const registeredUsers = REGISTERED[a.users];
  const activePct = ACTIVE_PCT[a.frequency];
  const mau = registeredUsers * (activePct / 100);

  const uses = a.aiUses.filter((u) => u !== 'multi');
  const tokenProfiles = (uses.length ? uses : a.aiUses.length ? ['chatbot' as const] : []).map((u) => {
    if (u === 'agents') {
      const turns = 1 + a.agent.toolCallsPerRequest;
      return [turns * 3500, turns * 300];
    }
    return { chatbot: [2000, 400], content: [800, 1200], automation: [3000, 500] }[u];
  });
  const avg = (i: number) => (tokenProfiles.length ? Math.round(tokenProfiles.reduce((s, p) => s + p[i], 0) / tokenProfiles.length) : 0);
  const custom = a.aiLevel === 'custom';
  const adoption = type === 'ai_saas' || type === 'ai_agent' ? 1 : 0.5;

  return {
    registeredUsers,
    activePct,
    sessionsPerMau: SESSIONS[a.frequency],
    requestsPerSession: reqPerSession,
    pageViewsPerSession: pvPerSession,
    dbOpsPerRequest: dbOps,
    kbPerResponse: kbPerResp,
    mbPerPageView: mbPerPv,
    fileStorageBaseGb: shop ? 2 : 0,
    fileStorageMbPerUser: has('media') ? (type === 'social' ? 300 : 150) : has('file_uploads') ? 25 : 0,
    fileMbPerPageView: has('media') ? 0.8 : shop ? 0.5 : has('file_uploads') ? 0.1 : 0,
    dbStorageMbPerUser: dbMb,
    peakMultiplier: (a.geography === 'worldwide' ? 2 : 3) + (shop || type === 'social' ? 1 : 0) + (a.frequency === 'heavy' ? 1 : 0),
    emailsPerMau: has('email') ? 6 : has('auth') ? 1 : 0,
    smsPerMau: has('sms') ? 1.5 : 0,
    searchesPerSession: has('search') ? 2 : 0,
    eventsPerSession: events,
    errorRatePct: 0.1,
    realtimeMsgsPerDau: has('realtime') ? (type === 'social' ? 150 : 40) : 0,
    aiRequestsPerMau: a.aiUses.length === 0 ? 0 : custom ? round2(a.aiCustom.requestsPerMonth / Math.max(1, mau)) : AI_REQ_PER_MAU[a.aiLevel] * adoption,
    aiInputTokens: custom ? a.aiCustom.inputTokens : avg(0),
    aiOutputTokens: custom ? a.aiCustom.outputTokens : avg(1),
    aiCachedPct: 50,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const SECONDS_PER_MONTH = 30 * 86400;

/** Monthly totals derived from workload assumptions. Every number here is an assumption, not a measurement. */
export function derive(w: Workload, a: Answers) {
  const registered = w.registeredUsers;
  const mau = registered * (w.activePct / 100);
  const sessions = mau * w.sessionsPerMau;
  const dau = mau * Math.min(0.8, w.sessionsPerMau / 40);
  const pageViews = sessions * w.pageViewsPerSession;
  const requests = sessions * w.requestsPerSession;
  const avgRps = requests / SECONDS_PER_MONTH;
  const peakRps = avgRps * w.peakMultiplier;
  const dbOps = requests * w.dbOpsPerRequest;
  const peakDbQps = (dbOps / SECONDS_PER_MONTH) * w.peakMultiplier;
  const fileStorageGb = w.fileStorageBaseGb + (registered * w.fileStorageMbPerUser) / 1024;
  const fileEgressGb = (pageViews * w.fileMbPerPageView) / 1024;
  const aiRequests = mau * w.aiRequestsPerMau;
  const usesMcp = a.features.includes('mcp') || (a.aiUses.includes('agents') && a.agent.mcpServers > 0);
  const mcpRequests = usesMcp ? aiRequests * a.agent.toolCallsPerRequest : 0;
  const cu = Math.min(16, Math.max(0.25, peakDbQps / 200));

  return {
    registered,
    mau,
    dau,
    sessions,
    pageViews,
    requests,
    avgRps,
    peakRps,
    dbOps,
    dbReads: dbOps * 0.8,
    dbWrites: dbOps * 0.2,
    peakDbQps,
    dbStorageGb: 0.25 + (registered * w.dbStorageMbPerUser) / 1024,
    dbEgressGb: (requests * w.kbPerResponse) / 1024 ** 2,
    fileStorageGb,
    fileEgressGb,
    frontendEgressGb: (pageViews * w.mbPerPageView) / 1024,
    apiEgressGb: (requests * w.kbPerResponse) / 1024 ** 2,
    cdnRequests: pageViews * 6,
    emails: mau * w.emailsPerMau,
    sms: mau * w.smsPerMau,
    searches: sessions * w.searchesPerSession,
    searchRecords: 1000 + registered * 2,
    events: sessions * w.eventsPerSession,
    errors: requests * (w.errorRatePct / 100),
    realtimeConnections: ((sessions / 30) * 10) / 960 * w.peakMultiplier,
    realtimeMessages: dau * w.realtimeMsgsPerDau * 30,
    mediaCredits: fileStorageGb + fileEgressGb + fileStorageGb * 0.15,
    videoMinStored: registered * 0.5,
    videoMinDelivered: pageViews * 0.2,
    aiRequests,
    usesMcp,
    mcpRequests,
    mcpEgressGb: (mcpRequests * 20) / 1024 ** 2,
    cacheCommands: requests * 2,
    vcpuSeconds: requests * 0.05,
    memGbSeconds: requests * 0.05 * 0.5,
    lambdaGbSeconds: requests * 0.1,
    cpuMs: requests * 5,
    activeCpuHours: (requests * 0.03) / 3600,
    fluidMemGbHours: (requests * 0.04) / 3600,
    storageClassA: fileStorageGb * 50,
    storageClassB: fileEgressGb * 2048,
    cuHours: cu * Math.min(730, (sessions * 15) / 60),
  };
}
export type Derived = ReturnType<typeof derive>;

/** Plain-language explanation shown under the assumptions. */
export const WORKLOAD_EXPLANATION = [
  'Monthly active users (MAU) = registered users × active %. Not every registered user comes back each month.',
  'API requests = MAU × sessions per user × requests per session.',
  'Database operations = API requests × DB operations per request.',
  'Bandwidth = page views × MB per page view + API responses + file downloads.',
  'Peak traffic = average requests per second × peak multiplier. Servers are sized for the peak.',
];
