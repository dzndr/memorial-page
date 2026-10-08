# Memorial website

A light, responsive memorial website with a public gallery and a password-protected area for family and friends. Astro renders `/` at build time; the Node server handles sign-in, the private gallery, and private WebP images. PhotoSwipe provides zoom, arrow-key navigation, Escape to close, and touch navigation. Without JavaScript, image links open the large image version. The included abstract SVGs are neutral placeholders. The public page includes YouTube and Spotify music examples above the photos. Each official player loads only after the visitor clicks its consent button; closing it removes the iframe. No consent is persisted. Direct links also work without JavaScript. Edit the music examples in `src/components/Music.astro` and include the providers in the site's privacy notice before publishing.

## Setup

Requires Node **22.19 or newer** and npm. Containers require Docker with **Compose 2.30 or newer**.

```sh
npm ci
cp .env.example .env
npm run password:hash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `AUTH_PASSWORD_HASH` in `.env` to the generated hash and `AUTH_COOKIE_SECRET` to the random key. The password utility prompts twice without displaying the password. Hash format: `scrypt$<32-character hexadecimal salt>$<128-character hexadecimal digest>`. scrypt uses Node's default parameters: N=16384, r=8, p=1. Do not commit hashes or keys or pass them as build arguments. The example values are intentionally invalid. A missing or invalid hash, key, or origin prevents startup.

The `.env` file used by Compose contains **unquoted** values: `format: raw` preserves dollar signs in the hash. Separately, `--env-file` supplies Compose variables such as `HTTP_PORT` and `IMAGE`. Do not load these files into a shell using `source`.

```sh
docker compose --env-file .env -f compose.dev.yaml up --build
```

Then open `http://localhost:4321`. The port is bound only to `127.0.0.1`. Source code is mounted into the container, and npm dependencies are stored in a dedicated volume. Images are regenerated on startup and whenever files in `content/` change; Astro updates the page automatically. The development server is intended for local access only.

To start Astro directly without Docker:

```sh
npm run dev
```

If you change `HTTP_PORT`, `SITE_ORIGIN` must exactly match the browser address: scheme, host, and port, without a trailing slash. Local development without Docker uses port 4321. `npm run dev` automatically loads `.env` from the project directory. Existing environment variables take precedence. Every environment uses a single `.env` file with the appropriate values. `localhost` and `127.0.0.1` are different origins.

## Editing content

`content/site.json` contains `title`, optional `lifeDates`, `introduction`, and ordered `public` and `private` lists. Each photo has a `source` relative to `content/photos/`, descriptive `alt` text, and an optional `caption`. Store images only in that directory, never in `public/`. Paths outside the image directory, including paths reached through symlinks, are rejected.

The build generates WebP thumbnails (up to 640 pixels) and large versions (up to 1920 pixels), corrects orientation, and removes image metadata. Original images are not copied. Public variants are stored in `public/bilder/`; private variants are stored in `.generated/privat/`. Private metadata is read only on the server; the public JSON contains no private list. In production, every content change requires a new build. For very small originals, the resized variants may have identical dimensions.

## Local production and verification

```sh
npm run check
npm test
npm run build
npm run test:access
npm run test:dev
node --env-file=.env scripts/start.mjs
```

The access tests generate temporary credentials, start a production server on port 4399, and check sign-in, sign-out, request origin, rate limiting, tampered and expired cookies, password changes, protected image variants, and public build files. A normal build does not require credentials. `npm run test:dev` checks the same access controls and text/image changes on the local development server. `npm run test:compose` validates the Compose configurations without a running Docker daemon and requires that no `.env` file exists. To test both container types with Docker running:

```sh
node scripts/container-test.mjs production
node scripts/container-test.mjs development
```

The development container test requires that **no `.env` file exists**. It creates one solely for the test and removes it afterward. It also checks that content changes appear without restarting. Temporarily move any existing environment file to a safe location before running this test. Also check the lightbox visually on desktop and mobile using Tab, Enter, arrow keys, Escape, and touch/pinch gestures.

```sh
docker build --target production -t gedenkseite:local .
# Set IMAGE=gedenkseite:local in .env to use the local image.
docker compose --env-file .env up -d
```

The runtime container runs as the `node` user, listens internally on port 4321, and contains neither original images nor environment files. The image contains resized private images and metadata and must therefore remain confidential.

## Authentication and reverse proxy

The form submits only a password. Sessions last eight hours and are stored in a signed `HttpOnly`/`SameSite=Lax` cookie, with `Secure` added for HTTPS. The password hash and cookie secret affect the signature; changing either and restarting the container invalidates existing sessions. Signing out removes the browser cookie. Without a database, there is no individual revocation list for cookies that have already been copied.

Without a session, private pages redirect to `/anmelden/`, and private image routes return 401. All private and authentication responses use `Cache-Control: no-store`. Private image IDs are resolved only against the generated list. Sign-in and sign-out require an `Origin` header that exactly matches `SITE_ORIGIN`. The rate limiter is intended to reject further sign-in attempts with 429 after ten failed attempts per IP within 15 minutes. The current implementation does not yet enforce that limit for concurrent requests. The counter uses bounded memory in a single server instance and resets on restart; multiple instances require a shared limiter.

`TRUST_PROXY=false` is the default. In this mode, the direct socket IP is used; behind a proxy, clients share the proxy's IP limit. With `TRUST_PROXY=true`, the first value in `X-Forwarded-For` is used. Enable this only if the upstream proxy **replaces** that header and the application port is accessible only to the proxy. Example using Caddy on the same host:

```caddyfile
gedenken.example.org {
    reverse_proxy 127.0.0.1:4321 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

Set `SITE_ORIGIN=https://gedenken.example.org` for this configuration. Caddy handles HTTPS. Never configure the proxy to cache private responses or route authentication requests away from the application server. Applying new authentication settings requires `docker compose --env-file .env up -d --force-recreate`.

## GHCR and CI

The GitHub Action checks pull requests, pushes to `main`, `v*` tags, and manual runs. After successful Astro checks, builds, and production/development access tests, it publishes only from `main` and version tags to `ghcr.io/<owner>/<repository>` for `linux/amd64`. Image tags are `sha-<full commit ID>`, `latest` for main, and the release version without `v`. Authentication uses `GITHUB_TOKEN`; there is no automatic server deployment.

The GHCR package must remain **private**. Check package and repository permissions before the first push, then verify the package's visibility in GitHub. Use a token with `read:packages` to pull private images on the server:

```sh
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_USER --password-stdin
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

`IMAGE` in `.env` selects the GHCR image tag; `HTTP_PORT` is the local host port. Credentials remain runtime values read from `process.env` and are not embedded in Astro builds.
