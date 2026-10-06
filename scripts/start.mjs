import { configuration } from '../src/lib/auth.mjs';
configuration();
await import('../dist/server/entry.mjs');
