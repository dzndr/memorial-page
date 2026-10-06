import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const GET: APIRoute = async ({ params }) => {
  const manifest = JSON.parse(await readFile(path.resolve('.generated/manifest.json'), 'utf8'));
  const variants = manifest.private.flatMap((photo: any) => [photo.thumb, photo.large]);
  const variant = variants.find((image: any) => image.id === params.id);
  if (!variant) return new Response('Bild nicht gefunden.', { status: 404 });
  const bytes = await readFile(path.resolve('.generated/private', variant.file));
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
};
