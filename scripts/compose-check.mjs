import { writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/lib/auth.mjs';
const hash=await hashPassword('compose-test-only');
const values=`AUTH_PASSWORD_HASH=${hash}\nAUTH_COOKIE_SECRET=${'be'.repeat(32)}\nSITE_ORIGIN=http://localhost:4321\nTRUST_PROXY=false\nHTTP_PORT=4321\nIMAGE=gedenkseite:test\n`;
const created=[];
try {
  const envFile='.env';
  await writeFile(envFile,values,{flag:'wx'}); created.push(envFile);
  for(const compose of ['compose.yaml','compose.dev.yaml']) {
    const result=spawnSync('docker',['compose','--env-file',envFile,'-f',compose,'config','--format','json'],{encoding:'utf8'});
    assert.equal(result.status,0,'Compose validation failed');
    const config=JSON.parse(result.stdout);
    assert.equal(config.services.web.environment.AUTH_PASSWORD_HASH.replaceAll('$$', '$'),hash,'Raw hash changed');
    assert.equal(config.services.web.ports[0].host_ip,'127.0.0.1');
  }
  console.log('Compose configurations valid; raw hashes preserved and ports restricted to localhost.');
} finally {for(const file of created) await rm(file,{force:true});}
