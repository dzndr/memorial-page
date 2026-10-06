import type { APIRoute } from 'astro';
import { configuration, sameOrigin, limiter, checkPassword, issueSession, cookieOptions, COOKIE } from '../../lib/auth.mjs';
export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const config = configuration();
  if (!sameOrigin(request, config)) return new Response('Unzulässige Formularherkunft.', { status: 403 });
  const ip = config.trustProxy ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress : clientAddress;
  if (limiter.blocked(ip)) return new Response('Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.', { status: 429, headers: { 'Retry-After': '900' } });
  if (Number(request.headers.get('content-length') || 0) > 8192) return new Response('Formular zu groß.', { status: 413 });
  let password;
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response('Ungültiges Formular.', { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return new Response('Formular zu groß.', { status: 413 }); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Ungültiges Formular.', { status: 415 });
    password = new URLSearchParams(body).get('password');
  } catch { return new Response('Ungültiges Formular.', { status: 400 }); }
  limiter.fail(ip); // Reserve before async scrypt so concurrent attempts are counted.
  if (!await checkPassword(password, config.hash)) {
    return new Response(null, { status: 303, headers: { Location: '/login/?error=password' } });
  }
  limiter.clear(ip);
  cookies.set(COOKIE, issueSession(config), cookieOptions(config));
  return new Response(null, { status: 303, headers: { Location: '/private/' } });
};
