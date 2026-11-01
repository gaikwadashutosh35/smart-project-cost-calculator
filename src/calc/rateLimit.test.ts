import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rateLimit } from '../../rateLimit';

function harness(opts: { perIp: number; global: number; windowMs: number }) {
  let t = 0;
  const limiter = rateLimit(opts, () => t);
  const hit = (ip: string) => {
    let status = 200;
    const headers: Record<string, string> = {};
    let body: { error?: string } = {};
    let passed = false;
    const res = {
      status(code: number) { status = code; return res; },
      set(k: string, v: string) { headers[k] = v; return res; },
      json(b: { error?: string }) { body = b; return res; },
    };
    limiter({ ip } as never, res as never, () => { passed = true; });
    return { passed, status, headers, body };
  };
  return { hit, advance: (ms: number) => { t += ms; } };
}

test('blocks an IP after its limit and tells it when to retry', () => {
  const { hit } = harness({ perIp: 2, global: 100, windowMs: 600_000 });
  assert.ok(hit('1.1.1.1').passed);
  assert.ok(hit('1.1.1.1').passed);
  const blocked = hit('1.1.1.1');
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['Retry-After'], '600');
  assert.match(blocked.body.error!, /10 minutes/);
  assert.ok(hit('2.2.2.2').passed, 'other IPs are unaffected');
});

test('global cap applies across IPs', () => {
  const { hit } = harness({ perIp: 5, global: 3, windowMs: 60_000 });
  assert.ok(hit('a').passed);
  assert.ok(hit('b').passed);
  assert.ok(hit('c').passed);
  assert.equal(hit('d').status, 429);
});

test('limits reset when the window ends', () => {
  const { hit, advance } = harness({ perIp: 1, global: 1, windowMs: 60_000 });
  assert.ok(hit('a').passed);
  assert.equal(hit('a').status, 429);
  advance(60_000);
  assert.ok(hit('a').passed);
});
