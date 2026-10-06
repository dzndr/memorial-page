import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, hashPassword, checkPassword, issueSession, validSession, FailureLimiter, sameOrigin, cookieOptions, TTL } from '../src/lib/auth.mjs';
const hash = await hashPassword('test-passwort');
const env = { AUTH_PASSWORD_HASH: hash, AUTH_COOKIE_SECRET: 'ab'.repeat(32), SITE_ORIGIN: 'http://localhost:4321' };
const config = configuration(env);
test('scrypt passwords and malformed configuration', async () => {
  assert.equal(await checkPassword('test-passwort', hash), true);
  assert.equal(await checkPassword('falsch', hash), false);
  assert.equal(await checkPassword(null, hash), false);
  assert.equal(await checkPassword('x'.repeat(1025), hash), false);
  for (const change of [{AUTH_PASSWORD_HASH:''}, {AUTH_COOKIE_SECRET:'short'}, {SITE_ORIGIN:'https://example.org/path'}, {TRUST_PROXY:'yes'}]) assert.throws(() => configuration({...env,...change}));
});
test('signed sessions expire, reject tampering, and invalidate after password changes', async () => {
  const now = Date.now();
  const token = issueSession(config, now);
  assert.equal(validSession(token, config, now), true);
  assert.equal(validSession(token, config, now + TTL * 1000), false);
  assert.equal(validSession(token.slice(0,-1) + (token.endsWith('A') ? 'B' : 'A'), config, now), false);
  assert.equal(validSession(token, {...config, hash: await hashPassword('neu')}, now), false);
  assert.equal(validSession(token, {...config, secret:'cd'.repeat(32)}, now), false);
  for (const value of [undefined, '', '../secret', '0.x.y', 'x'.repeat(10000)]) assert.equal(validSession(value, config), false);
});
test('origin and cookie policy', () => {
  assert.equal(sameOrigin(new Request(config.origin, {headers:{origin:config.origin}}), config), true);
  assert.equal(sameOrigin(new Request(config.origin), config), false);
  assert.equal(sameOrigin(new Request(config.origin, {headers:{origin:'https://attacker.example'}}), config), false);
  assert.equal(cookieOptions(config).secure, false);
  assert.equal(cookieOptions({...config,secure:true}).secure, true);
});
test('ten failures per client within fifteen minutes', () => {
  const limiter = new FailureLimiter();
  for(let i=0;i<10;i++) {assert.equal(limiter.blocked('a',1000),false); limiter.fail('a',1000);}
  assert.equal(limiter.blocked('a',1000),true);
  assert.equal(limiter.blocked('b',1000),false);
  assert.equal(limiter.blocked('a',901000),false);
  limiter.fail('a'); limiter.clear('a'); assert.equal(limiter.entries.size,0);
});

test('rate limiting uses a sliding window across the first failure expiry', () => {
  const limiter = new FailureLimiter();
  limiter.fail('a', 0);
  for(let i=0;i<9;i++) limiter.fail('a', 840000);
  assert.equal(limiter.blocked('a', 900000), false);
  limiter.fail('a', 900000);
  assert.equal(limiter.blocked('a', 900001), true);
});
