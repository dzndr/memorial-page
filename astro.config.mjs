import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
export default defineConfig({
  output: 'server', adapter: node({ mode: 'standalone', bodySizeLimit: 8192 }),
  // Auth endpoints enforce SITE_ORIGIN at runtime, including HTTPS behind a proxy.
  security: { checkOrigin: false },
  trailingSlash: 'ignore', server: { host: '0.0.0.0', port: 4321 },
  vite: { server: { fs: { deny: ['.env', '.env.*', '**/content/**', '**/.generated/**', '**/scripts/**', '**/tests/**', '**/src/pages/**', '**/src/lib/**', '**/src/middleware.ts'] } } },
});
