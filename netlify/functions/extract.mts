import type { Config } from '@netlify/functions';
import { handleExtract, webHandler } from '../../claude.ts';

// Description → suggested answers. Cheap (~1 cent per call), so no rate-limit rule: the Free plan allows only 2.
export default webHandler(handleExtract);

export const config: Config = { path: '/api/extract', method: 'POST' };
