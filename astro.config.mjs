import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
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
