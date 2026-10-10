import { readFile, writeFile } from 'node:fs/promises';
const origin=process.env.TEST_BASE_URL || 'http://127.0.0.1:4321';
const original=await readFile('content/site.json','utf8');
const content=JSON.parse(original);
const source='content/photos/public/'+content.public[0].source;
const image=await readFile(source);
const manifest=JSON.parse(await readFile('.generated/manifest.json','utf8'));
const imageUrl=manifest.public[0].thumb.url;
const before=Buffer.from(await (await fetch(origin+imageUrl)).arrayBuffer());
async function waitFor(check) {
  for(let i=0;i<100;i++) {try {if(await check()) return;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  throw new Error('Hot reload did not appear within 20 seconds');
}
try {
  content.title='Hot Reload geprüft';
  await writeFile('content/site.json',JSON.stringify(content));
  await waitFor(async()=>(await (await fetch(origin+'/')).text()).includes(content.title));
  // The local sample images are SVG placeholders; replace one with a different image.
  await writeFile(source,'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#dd1122"/></svg>');
  await waitFor(async()=>{const response=await fetch(origin+imageUrl);return response.ok && !Buffer.from(await response.arrayBuffer()).equals(before);});
  console.log('Development hot reload passed for content and image changes.');
} finally {
  await writeFile(source,image);
  await writeFile('content/site.json',original);
  await waitFor(async()=>(await (await fetch(origin+'/')).text()).includes(JSON.parse(original).title));
}
