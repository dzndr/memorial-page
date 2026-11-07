import sharp from 'sharp'
import { readFile, mkdir, rm, writeFile, realpath, cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const root = fileURLToPath(new URL('../', import.meta.url))

const imageExtensions = new Set(['.svg', '.jpg', '.jpeg', '.png', '.webp'])

function galleryError(index, message) {
  return new Error(`gallery[${index}]: ${message}`)
}

function isInside(parent, child) {
  return child === parent || child.startsWith(parent + path.sep)
}

function validateYouTubeSource(value, index) {
  if (typeof value !== 'string') throw galleryError(index, 'youtube must be a URL')
  let url
  try {
    url = new URL(value)
  } catch {
    throw galleryError(index, 'youtube must be a valid URL')
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    throw galleryError(index, 'youtube must be an HTTPS YouTube URL')
  }
  return url.toString()
}

export async function prepareImages() {
  const content = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'))
  if (typeof content.name !== 'string' || !content.name.trim()) throw new Error('Name is missing')
  if (typeof content.subtitle !== 'string' || !content.subtitle.trim()) throw new Error('Subtitle is missing')
  const theme = content.theme ?? 'auto'
  if (theme !== 'light' && theme !== 'dark' && theme !== 'auto') throw new Error('Theme must be light, dark or auto')
  if (!Array.isArray(content.gallery)) throw new Error('gallery must be an array')
  const publicFolder = 'public/images'
  const buildFolder = 'build/images'
  await rm(path.join(root, publicFolder), { recursive: true, force: true })
  await rm(path.join(root, buildFolder), { recursive: true, force: true })
  await mkdir(path.join(root, publicFolder), { recursive: true })
  await mkdir(path.join(root, buildFolder), { recursive: true })
  const manifest = { name: content.name, subtitle: content.subtitle, theme, gallery: [] }
  const contentFolder = await realpath(path.join(root, 'content'))
  const generatedImages = []
  for (const [index, entry] of content.gallery.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw galleryError(index, 'must be an image or youtube object')
    const keys = Object.keys(entry)
    if ('youtube' in entry) {
      if (keys.length !== 1) throw galleryError(index, 'youtube entries cannot have other properties')
      manifest.gallery.push({ type: 'youtube', src: validateYouTubeSource(entry.youtube, index) })
      continue
    }
    if (!('image' in entry) || keys.some(key => key !== 'image' && key !== 'objectPosition')) {
      throw galleryError(index, 'must contain image (and optionally objectPosition), or youtube')
    }
    if (typeof entry.image !== 'string' || !entry.image.trim()) throw galleryError(index, 'image must be a path relative to content/')
    if (entry.objectPosition !== undefined && (typeof entry.objectPosition !== 'string' || !entry.objectPosition.trim())) {
      throw galleryError(index, 'objectPosition must be a non-empty CSS value')
    }
    const source = await realpath(path.resolve(contentFolder, entry.image))
    if (!isInside(contentFolder, source)) throw galleryError(index, 'image must stay inside content/')
    if (!imageExtensions.has(path.extname(source).toLowerCase())) throw galleryError(index, 'image must be an SVG, JPG, PNG, or WebP file')
    const input = await readFile(source)
    const id = `gallery-${index + 1}`
    const variants = {}
    for (const [name, size] of [['thumb', 320], ['large', 1200]]) {
      const file = `${id}-${name}.webp`
      const info = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(root, buildFolder, file))
      variants[name] = { id: `${id}-${name}`, file, width: info.width, height: info.height, url: `/images/${file}` }
    }
    manifest.gallery.push({ type: 'image', ...variants, ...(entry.objectPosition ? { objectPosition: entry.objectPosition } : {}) })
    generatedImages.push(id)
  }
  await mkdir(path.join(root, 'build'), { recursive: true })
  await writeFile(path.join(root, 'build/public.json'), JSON.stringify(manifest, null, 2))
  await mkdir(path.join(root, publicFolder), { recursive: true })
  for (const id of generatedImages) {
    for (const name of ['thumb', 'large']) {
      const file = `${id}-${name}.webp`
      await cp(path.join(root, buildFolder, file), path.join(root, publicFolder, file))
    }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareImages()
