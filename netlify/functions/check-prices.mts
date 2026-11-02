import type { Config } from '@netlify/functions';
import { handleCheckPrices, webHandler } from '../../claude.ts';

// Reads up to 8 pricing pages (MAX_PRICE_PAGES in claude.ts) to stay inside Netlify's fixed 60-second limit.
export default webHandler(handleCheckPrices);

// The costliest call: 1 per visitor every 3 minutes (Netlify's maximum window is 180 s).
export const config: Config = {
  path: '/api/check-prices',
  method: 'POST',
  rateLimit: { windowLimit: 1, windowSize: 180, aggregateBy: ['ip', 'domain'] },
};
