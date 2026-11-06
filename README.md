# Memorial website

A light, responsive memorial page built with Astro. The site has a single page: a name and subtitle above a public photo gallery. SimpleLightbox provides zoom, arrow-key navigation, Escape to close, and touch navigation. Without JavaScript, image links open the large image version. The color theme is chosen at build time and baked into the page.

Images are supplied locally in `content/images/` and are not tracked by Git. The site itself is fully static; authentication and a private area were removed in a previous iteration.

## Setup

Requires Node **22.19 or newer** and npm. Containers require Docker with **Compose 2.30 or newer**.

```sh
npm ci
cp .env.example .env
```

`.env` contains only Compose variables: `IMAGE` (the production image to run) and `HTTP_PORT` (default `4321`). The `.env` file uses **unquoted** values (`format: raw`). Do not load it into a shell using `source`.

```sh
docker compose --env-file .env -f compose.dev.yaml up --build
```

Then open `http://localhost:4321`. The port is bound only to `127.0.0.1`. Source code is mounted into the container, and npm dependencies are stored in a dedicated volume. Image variants are regenerated on startup and whenever files in `content/` change; Astro updates the page automatically. The development server is intended for local access only.

To start Astro directly without Docker:

```sh
npm run dev
```

## Editing content

- `content/site.json` holds the page `name` and `subtitle`, plus an optional `theme`:
  - `auto` (default) follows the browser/system color scheme.
  - `light` always uses the light theme.
  - `dark` always uses the dark theme.
- Photo originals go into the top level of `content/images/`. Every image file (`.svg`, `.jpg`, `.jpeg`, `.png`, `.webp`) in that folder becomes a gallery entry, in alphabetical filename order. Rename files to reorder the gallery; hidden files and subfolders are ignored.

The build (`scripts/images.mjs`) generates a WebP thumbnail (up to 320 pixels) and a large version (up to 1200 pixels) for every photo, corrects orientation, removes metadata, and writes the resulting manifest to `build/public.json`. Variants are stored in `public/images/`. Originals are not copied into the output. In production, every content change requires a new build. For very small originals, the resized variants may have identical dimensions.

## Local production and verification

```sh
npm run check
npm run build
npm run preview
```

`npm run check` prepares the images and runs `astro check`; `npm run build` prepares the images and creates `dist/`; `npm run preview` serves `dist/` at `http://localhost:4321`.

Check the lightbox visually on desktop and mobile using Tab, Enter, arrow keys, Escape, and touch/pinch gestures. For `auto`, verify both system color schemes; for `light` and `dark`, verify the theme stays fixed when the system setting changes.

## Run the production container

```sh
docker build --target production -t gedenkseite:local .
```

Set `IMAGE=gedenkseite:local` in `.env`, then:

```sh
docker compose --env-file .env up -d
```

The runtime image is `nginx:alpine` serving `dist/` from the single static `nginx.conf`: it listens on port 4321, enables gzip for text assets, and sends `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on every response. It contains only the built page and processed images.

## Publish Docker images

There are no CI workflows; build and push from your own computer after adding your images. Choose a registry and a release tag (the examples use `1.0.0`), and rebuild for the server architecture if it differs from your computer's:

```sh
docker build --platform linux/amd64 --target production -t gedenkseite:local .
```

Docker Hub:

```sh
docker login --username YOUR_USER
docker tag gedenkseite:local YOUR_USER/gedenkseite:1.0.0
docker push YOUR_USER/gedenkseite:1.0.0
```

GHCR:

```sh
docker login ghcr.io --username YOUR_USER
docker tag gedenkseite:local ghcr.io/YOUR_NAMESPACE/gedenkseite:1.0.0
docker push ghcr.io/YOUR_NAMESPACE/gedenkseite:1.0.0
```

The image contains personal photos, so keep the repository **private** in either registry. On the server, log in to the registry, set `IMAGE` to the full image name in the server's `.env`, then:

```sh
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

Use a new release tag for each build and update `IMAGE` on the server before pulling.
