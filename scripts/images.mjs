import sharp from 'sharp';
import { readFile, mkdir, rm, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareImages() {
  const content = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
  if (typeof content.name !== 'string' || !content.name.trim()) throw new Error('Name is missing');
  if (typeof content.subtitle !== 'string' || !content.subtitle.trim()) throw new Error('Subtitle is missing');
  const publicFolder = 'public/images';
  await rm(path.join(root, publicFolder), { recursive: true, force: true });
  await mkdir(path.join(root, publicFolder), { recursive: true });
  const manifest = { name: content.name, subtitle: content.subtitle, public: [] };
  const visibility = 'public';
  if (!Array.isArray(content[visibility])) throw new Error('Image list is missing');
  const base = await realpath(path.join(root, 'content/photos', visibility));
  for (const [index, item] of content[visibility].entries()) {
    if (typeof item.source !== 'string' || typeof item.alt !== 'string' || !item.alt.trim()) throw new Error('Source or alt text is missing');
    const source = await realpath(path.resolve(base, item.source));
    if (!source.startsWith(base + path.sep)) throw new Error(`Image outside of content/photos/${visibility}`);
    const input = await readFile(source);
    const id = `${visibility}-${index + 1}`;
    const directory = path.join(root, publicFolder);
    const variants = {};
    for (const [name, size] of [['thumb', 640], ['large', 1920]]) {
      const file = `${id}-${name}.webp`;
      const info = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(directory, file));
      variants[name] = { id: `${id}-${name}`, file, width: info.width, height: info.height, url: `/images/${file}` };
    }
    manifest[visibility].push({ alt: item.alt, caption: item.caption || '', ...variants });
  }
  await mkdir(path.join(root, '.generated'), { recursive: true });
  await writeFile(path.join(root, '.generated/public.json'), JSON.stringify(manifest, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareImages();
