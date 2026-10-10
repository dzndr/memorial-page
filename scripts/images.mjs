import sharp from 'sharp';
import { readFile, mkdir, rm, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareImages() {
  const content = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
  if (typeof content.title !== 'string' || !content.title.trim()) throw new Error('Titel fehlt');
  for (const folder of ['public/images', '.generated/private']) {
    await rm(path.join(root, folder), { recursive: true, force: true });
    await mkdir(path.join(root, folder), { recursive: true });
  }
  const manifest = { title: content.title, lifeDates: content.lifeDates || '', introduction: content.introduction || '', public: [], private: [] };
  for (const visibility of ['public', 'private']) {
    if (!Array.isArray(content[visibility])) throw new Error('Bilderliste fehlt');
    const base = await realpath(path.join(root, 'content/photos', visibility));
    for (const [index, item] of content[visibility].entries()) {
      if (typeof item.source !== 'string' || typeof item.alt !== 'string' || !item.alt.trim()) throw new Error('Quelle oder Alternativtext fehlt');
      const source = await realpath(path.resolve(base, item.source));
      if (!source.startsWith(base + path.sep)) throw new Error(`Bild außerhalb von content/photos/${visibility}`);
      const input = await readFile(source);
      const id = `${visibility}-${index + 1}`;
      const directory = path.join(root, visibility === 'public' ? 'public/images' : '.generated/private');
      const variants = {};
      for (const [name, size] of [['thumb', 640], ['large', 1920]]) {
        const file = `${id}-${name}.webp`;
        const info = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(directory, file));
        variants[name] = { id: `${id}-${name}`, file, width: info.width, height: info.height, url: visibility === 'public' ? `/images/${file}` : `/private/images/${id}-${name}/` };
      }
      manifest[visibility].push({ alt: item.alt, caption: item.caption || '', ...variants });
    }
  }
  await mkdir(path.join(root, '.generated'), { recursive: true });
  await writeFile(path.join(root, '.generated/manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(root, '.generated/public.json'), JSON.stringify({ ...manifest, private: undefined }, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareImages();
