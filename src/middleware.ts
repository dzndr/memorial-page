import { defineMiddleware } from 'astro:middleware';
import { configuration, validSession, COOKIE } from './lib/auth.mjs';
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  const config = configuration();
  let pathname: string;
  try { pathname = decodeURIComponent(context.url.pathname); } catch { return new Response(null, { status: 400 }); }
  const route = context.routePattern || pathname;
  const privateRoute = route === '/private' || route.startsWith('/private/') || pathname === '/private' || pathname.startsWith('/private/');
  const loginRoute = pathname === '/login' || pathname === '/login/';
  const hasValidSession = validSession(context.cookies.get(COOKIE)?.value, config);
  
  if (privateRoute && !hasValidSession) {
    return new Response(null, { status: pathname.startsWith('/private/images/') ? 401 : 303, headers: { ...(pathname.startsWith('/private/images/') ? {} : { Location: '/login/' }), 'Cache-Control': 'no-store' } });
  }
  
  if (loginRoute && hasValidSession) {
    return new Response(null, { status: 303, headers: { Location: '/private/', 'Cache-Control': 'no-store' } });
  }
  const response = await next();
  if (privateRoute || pathname.startsWith('/api/') || pathname.startsWith('/login')) response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
});
