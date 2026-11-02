import type { Config } from '@netlify/functions';
import { handleReview, webHandler } from '../../claude.ts';

export default webHandler(handleReview);

// 3 reviews per visitor every 3 minutes (Netlify's maximum window is 180 s).
export const config: Config = {
  path: '/api/review',
  method: 'POST',
  rateLimit: { windowLimit: 3, windowSize: 180, aggregateBy: ['ip', 'domain'] },
};
