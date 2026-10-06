import { spawn } from 'node:child_process';
import { hashPassword } from '../src/lib/auth.mjs';
const env={...process.env,AUTH_PASSWORD_HASH:await hashPassword('dev-test-only'),AUTH_COOKIE_SECRET:'bd'.repeat(32),SITE_ORIGIN:'http://127.0.0.1:4321',TRUST_PROXY:'false',TEST_BASE_URL:'http://127.0.0.1:4321',TEST_PASSWORD:'dev-test-only',ASTRO_TELEMETRY_DISABLED:'1'};
const server=spawn(process.execPath,['--env-file-if-exists=.env','scripts/dev.mjs'],{env,stdio:'inherit'});
try {
  for (const script of ['scripts/access-test.mjs', 'scripts/hot-reload-test.mjs']) {
    await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{env,stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(new Error(`${script} failed`)));});
  }
} finally {
  server.kill('SIGTERM');
  if(server.exitCode===null) await new Promise(resolve=>server.on('exit',resolve));
}
