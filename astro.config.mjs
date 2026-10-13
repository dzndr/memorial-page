import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  server: { host: '0.0.0.0', port: 4321 },
  vite: {
    server: {
      fs: {
        deny: [
          '.env', '.env.*',
          '**/content/**',
          '**/.generated/**',
          '**/scripts/**',
          '**/tests/**'
        ]
      }
    }
  }
});
