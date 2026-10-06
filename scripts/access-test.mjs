import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { hashPassword, configuration, issueSession, COOKIE, TTL } from '../src/lib/auth.mjs';
const password = 'access-test-only';
const hash = await hashPassword(password);
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4399';
const env = { ...process.env, AUTH_PASSWORD_HASH: hash, AUTH_COOKIE_SECRET: 'ac'.repeat(32), SITE_ORIGIN: origin, TRUST_PROXY:'false', HOST:'127.0.0.1', PORT:'4399' };
const external = Boolean(process.env.TEST_BASE_URL);
const server = external ? null : spawn(process.execPath,['scripts/start.mjs'],{env,stdio:['ignore','pipe','pipe']});
let logs='';
server?.stdout.on('data',chunk=>logs+=chunk); server?.stderr.on('data',chunk=>logs+=chunk);
const config = external ? configuration(process.env) : configuration(env);
const loginPassword = external ? process.env.TEST_PASSWORD : password;
async function request(path, options={}) { return fetch(origin+path,{redirect:'manual',...options}); }
const post = (path, value, options={}) => request(path,{method:'POST',body:new URLSearchParams({password:value}),...options,headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...options.headers}});
try {
  let ready=false;
  for(let i=0;i<600;i++) {
    try { if((await request('/')).status===200) {ready=true;break;} } catch {}
    if(server?.exitCode != null) throw new Error(logs);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready, 'server did not start: '+logs);
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/login/')).status,200);
  assert.equal((await request('/private/')).status,303);
  for(const path of ['/%70rivate/', '/priv%61te/']) assert.ok([303,404].includes((await request(path)).status),path);
  const manifest=JSON.parse(await readFile('.generated/manifest.json','utf8'));
  const paths=manifest.private.flatMap(p=>[p.thumb.url,p.large.url]);
  for(const path of paths) {
    const response=await request(path); assert.equal(response.status,401); assert.equal(response.headers.get('cache-control'),'no-store');
  }
  for(const path of ['/images/private-1-thumb.webp','/.generated/manifest.json','/.generated/private/private-1-large.webp','/content/site.json','/content/photos/naehe.svg', '/src/pages/private/index.astro?raw', `/@fs/${process.cwd()}/.generated/manifest.json`, `/@fs/${process.cwd()}/content/photos/naehe.svg`]) assert.ok([403,404].includes((await request(path)).status),path);
  for(const path of ['/api/login','/api/logout']) assert.equal((await post(path,'wrong',{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await post('/api/login','wrong',{headers:{Origin:''}})).status,403);
  const wrong=await post('/api/login','wrong');
  assert.equal(wrong.headers.get('location'),'/login/?error=password', `status=${wrong.status} body=${await wrong.text()} logs=${logs}`);
  const login=await post('/api/login',loginPassword);
  assert.equal(login.status,303); assert.equal(login.headers.get('location'),'/private/');
  const setCookie=login.headers.get('set-cookie');
  assert.match(setCookie,/HttpOnly/i); assert.match(setCookie,/SameSite=Lax/i); assert.match(setCookie,/Max-Age=28800/i);
  if(config.secure) assert.match(setCookie,/Secure/i);
  const cookie=setCookie.split(';')[0];
  const page=await request('/private/',{headers:{Cookie:cookie}}); assert.equal(page.status,200); assert.equal(page.headers.get('cache-control'),'no-store');
  for(const path of paths) {const response=await request(path,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('cache-control'),'no-store');}
  assert.equal((await request('/private/images/unknown/',{headers:{Cookie:cookie}})).status,404);
  assert.equal((await request('/private/images/%2e%2e%2fmanifest.json/',{headers:{Cookie:cookie}})).status,404);
  for(const token of [issueSession(config,Date.now()-(TTL+1)*1000),issueSession({...config,hash:await hashPassword('changed')}),issueSession(config).slice(0,-3)+'abc']) {
    assert.equal((await request('/private/',{headers:{Cookie:`${COOKIE}=${token}`}})).status,303);
    assert.equal((await request(paths[0],{headers:{Cookie:`${COOKIE}=${token}`}})).status,401);
  }
  const logout=await post('/api/logout','',{headers:{Origin:origin,Cookie:cookie}});
  assert.equal(logout.status,303); assert.match(logout.headers.get('set-cookie'),/Max-Age=0/i);
  assert.equal((await request('/private/',{headers:{Cookie:`${COOKIE}=`}})).status,303);
  for(let i=0;i<10;i++) assert.equal((await post('/api/login','wrong',{headers:{'X-Forwarded-For':`198.51.100.${i}`}})).status,303);
  assert.equal((await post('/api/login',loginPassword)).status,429);
  const html=await (await request('/')).text();
  for(const p of manifest.private) {assert.ok(!html.includes(p.alt));assert.ok(!html.includes(p.caption));}
  async function audit(directory) {
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      const file=directory+'/'+entry.name;
      if(entry.isDirectory()) await audit(file);
      else {const bytes=await readFile(file);assert.ok(!bytes.includes(Buffer.from(config.hash)),file);assert.ok(!bytes.includes(Buffer.from(config.secret)),file);if(directory.startsWith('dist/client')) for(const p of manifest.private) {assert.ok(!bytes.includes(Buffer.from(p.alt)),file);assert.ok(!bytes.includes(Buffer.from(p.caption)),file);assert.ok(!file.includes('private-'),file);}}
    }
  }
  if(!external) {
    await audit('dist');
    const invalid=spawn(process.execPath,['scripts/start.mjs'],{env:{...env,AUTH_PASSWORD_HASH:''},stdio:'ignore'});
    assert.notEqual(await new Promise(resolve=>invalid.on('exit',resolve)),0);
  }
  console.log('Access tests passed: authentication, images, origin, rate limits, cookies, and public output.');
} finally {
  if(server && server.exitCode===null) {server.kill('SIGTERM');await new Promise(resolve=>server.on('exit',resolve));}
}
