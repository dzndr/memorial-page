import { prepareImages } from './images.mjs';
import { watch } from 'chokidar';
import { spawn } from 'node:child_process';
await prepareImages();
let pending = false;
let running = false;
async function rebuild() {
  pending = true;
  if (running) return;
  running = true;
  while (pending) {
    pending = false;
    try { await prepareImages(); } catch (error) { console.error(error); }
  }
  running = false;
}
const watcher = watch('content', { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 250 } });
watcher.on('all', rebuild);
const child = spawn(process.execPath, ['node_modules/.bin/astro', 'dev', '--ignore-lock', '--host', '0.0.0.0'], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', async code => { await watcher.close(); process.exit(code ?? 1); });
