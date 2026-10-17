import sharp from 'sharp';
import { readFile, mkdir, rm, writeFile, realpath, readdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareImages() {
  const content = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
  if (typeof content.name !== 'string' || !content.name.trim()) throw new Error('Name is missing');
  if (typeof content.subtitle !== 'string' || !content.subtitle.trim()) throw new Error('Subtitle is missing');
  const publicFolder = 'public/images';
  const buildFolder = 'build/images';
  await rm(path.join(root, publicFolder), { recursive: true, force: true });
  await rm(path.join(root, buildFolder), { recursive: true, force: true });
  await mkdir(path.join(root, publicFolder), { recursive: true });
  await mkdir(path.join(root, buildFolder), { recursive: true });
  const manifest = { name: content.name, subtitle: content.subtitle, public: [] };
  const base = await realpath(path.join(root, 'content/images'));
  const files = (await readdir(base))
    .filter(f => !f.startsWith('.') && f.endsWith('.svg'))
    .sort();
  for (const [index, filename] of files.entries()) {
    const source = await realpath(path.join(base, filename));
    if (!source.startsWith(base + path.sep)) throw new Error(`Image outside of content/images`);
    const input = await readFile(source);
    const id = `public-${index + 1}`;
    const variants = {};
    for (const [name, size] of [['thumb', 640], ['large', 1920]]) {
      const file = `${id}-${name}.webp`;
      const info = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(root, buildFolder, file));
      variants[name] = { id: `${id}-${name}`, file, width: info.width, height: info.height, url: `/images/${file}` };
    }
    manifest.public.push({ ...variants });
  }
  await mkdir(path.join(root, 'build'), { recursive: true });
  await writeFile(path.join(root, 'build/public.json'), JSON.stringify(manifest, null, 2));
  await mkdir(path.join(root, publicFolder), { recursive: true });
  for (const [index, filename] of files.entries()) {
    const id = `public-${index + 1}`;
    for (const name of ['thumb', 'large']) {
      const file = `${id}-${name}.webp`;
      await cp(path.join(root, buildFolder, file), path.join(root, publicFolder, file));
    }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareImages();
