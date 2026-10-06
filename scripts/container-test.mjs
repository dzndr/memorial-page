import { spawnSync, spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { hashPassword } from '../src/lib/auth.mjs';
const mode=process.argv[2] || 'production';
const dev=mode==='development';
const origin='http://127.0.0.1:4399';
const env={...process.env,AUTH_PASSWORD_HASH:await hashPassword('container-test-only'),AUTH_COOKIE_SECRET:'ad'.repeat(32),SITE_ORIGIN:origin,TRUST_PROXY:'false',TEST_PASSWORD:'container-test-only',TEST_BASE_URL:origin};
function run(command,args) {const result=spawnSync(command,args,{env,stdio:'inherit'});if(result.status!==0) throw new Error(`${command} failed`);}
const compose=['compose','--env-file','.env','-f','compose.dev.yaml','-p','gedenk-access-test'];
let createdEnv=false;
let containerStarted=false;
try {
  if(dev) {
    await writeFile('.env',`AUTH_PASSWORD_HASH=${env.AUTH_PASSWORD_HASH}\nAUTH_COOKIE_SECRET=${env.AUTH_COOKIE_SECRET}\nSITE_ORIGIN=${origin}\nTRUST_PROXY=false\nHTTP_PORT=4399\n`,{flag:'wx'});
    createdEnv=true;
    run('docker',[...compose,'up','--build','-d']);
  } else {
    run('docker',['build','--target','production','-t','gedenkseite:test','.']);
    run('docker',['run','--rm','-d','--name','gedenk-access-test','-p','127.0.0.1:4399:4321',...['AUTH_PASSWORD_HASH','AUTH_COOKIE_SECRET','SITE_ORIGIN','TRUST_PROXY'].flatMap(key=>['-e',key]),'gedenkseite:test']);
    containerStarted=true;
    const invalid=spawnSync('docker',['run','--rm','gedenkseite:test'],{stdio:'ignore'});
    if(invalid.status===0) throw new Error('Container accepted missing configuration');
    const user=spawnSync('docker',['inspect','--format','{{.Config.User}}','gedenk-access-test'],{encoding:'utf8'});
    if(user.stdout.trim()!=='node') throw new Error('Container must run as node');
  }
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/access-test.mjs'],{env,stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(new Error('Access tests failed')));});
  if(dev) {
    await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/hot-reload-test.mjs'],{env,stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(new Error('Hot reload failed')));});
  }
} finally {
  if(dev) {
    if(createdEnv) {
      try { run('docker',[...compose,'down','-v']); }
      finally { await rm('.env',{force:true}); }
    }
  } else if(containerStarted) spawnSync('docker',['rm','-f','gedenk-access-test'],{stdio:'ignore'});
}
