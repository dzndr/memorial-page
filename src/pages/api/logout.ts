import type { APIRoute } from 'astro';
import { configuration, sameOrigin, cookieOptions, COOKIE } from '../../lib/auth.mjs';
export const POST: APIRoute = async ({ request, cookies }) => {
  const config = configuration();
  if (!sameOrigin(request, config)) return new Response('Unzulässige Formularherkunft.', { status: 403 });
  cookies.set(COOKIE, '', { ...cookieOptions(config), maxAge: 0 });
  return new Response(null, { status: 303, headers: { Location: '/' } });
};
