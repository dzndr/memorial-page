import { randomBytes, scrypt as scryptCallback, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const COOKIE = 'gedenk_session';
export const TTL = 8 * 60 * 60;
export function parseHash(hash) {
  if (typeof hash !== 'string' || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash)) throw new Error('AUTH_PASSWORD_HASH muss ein gültiger scrypt-Hash sein');
  const [, salt, digest] = hash.split('$');
  return { salt, digest: Buffer.from(digest, 'hex') };
}
export function configuration(env = process.env) {
  parseHash(env.AUTH_PASSWORD_HASH);
  if (!env.AUTH_COOKIE_SECRET || !/^[a-f0-9]{64,}$/.test(env.AUTH_COOKIE_SECRET)) throw new Error('AUTH_COOKIE_SECRET benötigt mindestens 32 zufällige Bytes als Hex');
  let url;
  try { url = new URL(env.SITE_ORIGIN); } catch { throw new Error('SITE_ORIGIN fehlt oder ist ungültig'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== env.SITE_ORIGIN) throw new Error('SITE_ORIGIN muss eine reine HTTP(S)-Origin sein');
  if (!['true', 'false', undefined].includes(env.TRUST_PROXY)) throw new Error('TRUST_PROXY muss true oder false sein');
  return { hash: env.AUTH_PASSWORD_HASH, secret: env.AUTH_COOKIE_SECRET, origin: url.origin, secure: url.protocol === 'https:', trustProxy: env.TRUST_PROXY === 'true' };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function checkPassword(password, hash) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  const { salt, digest } = parseHash(hash);
  return timingSafeEqual(await scrypt(password, salt, 64), digest);
}
function signature(payload, config) {
  return createHmac('sha256', config.secret).update(payload + ':' + createHash('sha256').update(config.hash).digest('hex')).digest('base64url');
}
export function issueSession(config, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + TTL}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${signature(payload, config)}`;
}
export function validSession(token, config, now = Date.now()) {
  if (typeof token !== 'string' || !/^\d{10}\.[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [expires, nonce, sig] = token.split('.');
  const remaining = Number(expires) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > TTL) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(signature(`${expires}.${nonce}`, config)));
}
/** @returns {import('astro').AstroCookieSetOptions} */
export function cookieOptions(config) {
  return { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secure, maxAge: TTL };
}
export function sameOrigin(request, config) { return request.headers.get('origin') === config.origin; }
export function getSession(request, config) {
  const cookieHeader = request?.headers?.get('cookie');
  const cookieValue = cookieHeader?.split(';').find(c => c.trim().startsWith(COOKIE + '='))?.split('=')[1];
  return cookieValue ? validSession(cookieValue, config) : false;
}
// Bounded memory; saturated storage refuses new clients until entries expire.
export class FailureLimiter {
  constructor() { this.entries = new Map(); }
  blocked(ip, now = Date.now()) {
    const cutoff = now - 15 * 60 * 1000;
    for (const [key, timestamps] of this.entries) {
      const recent = timestamps.filter(time => time > cutoff);
      if (recent.length) this.entries.set(key, recent);
      else this.entries.delete(key);
    }
    const entry = this.entries.get(ip);
    return entry ? entry.length >= 10 : this.entries.size >= 10000;
  }
  fail(ip, now = Date.now()) {
    const recent = (this.entries.get(ip) || []).filter(time => time > now - 15 * 60 * 1000);
    recent.push(now);
    this.entries.set(ip, recent);
  }
  clear(ip) { this.entries.delete(ip); }
}
export const limiter = new FailureLimiter();
