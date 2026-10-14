# Memorial website

A light, responsive memorial website with a public gallery and a password-protected area for family and friends. Astro renders `/` at build time; the Node server handles sign-in, the private gallery, and private WebP images. PhotoSwipe provides zoom, arrow-key navigation, Escape to close, and touch navigation. Without JavaScript, image links open the large image version. Images are supplied locally and are not tracked by Git. Music is not integrated yet; a dedicated Astro component can be added to the layout later.

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

`content/site.json` contains `name` and `subtitle`, and an ordered `public` photo list. Each photo has a `source` filename, descriptive `alt` text, and an optional `caption`. Put the original files in the folder `content/photos/public/`.

For example, a public entry with `"source": "licht.svg"` reads `content/photos/public/licht.svg`. Nested paths within the matching folder are supported. Paths outside that folder, including paths reached through symlinks, are rejected.

The folder is kept in Git using empty `.gitkeep` files. Original images and generated variants are ignored; existing images remain on your computer. A fresh clone contains no images: supply every file referenced in `content/site.json`, or replace the list with your own entries before building.

The build generates WebP thumbnails (up to 640 pixels) and large versions (up to 1920 pixels), corrects orientation, and removes image metadata. Original images are not copied. Public variants are stored in `public/images/`. In production, every content change requires a new build. For very small originals, the resized variants may have identical dimensions.

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

## Build and publish Docker images locally

There are no GitHub Actions. Build and publish from your own computer after adding your local images and updating `content/site.json`. Start Docker Desktop (or your Docker daemon), then run these commands from the repository root.

### Build

```sh
docker build --target production -t gedenkseite:local .
```

Docker installs dependencies, checks the site, and generates the production build. You do not need Node installed on the host or an `.env` file to build. Both local image folders are included in the build context even though Git ignores them. The final image includes the processed public and private images; originals and `.env` files are excluded from the runtime image. Do not pass authentication secrets as build arguments.

By default, Docker builds for your computer's architecture. If the server uses a different architecture, specify it when building, for example:

```sh
docker build --platform linux/amd64 --target production -t gedenkseite:local .
```

For an ARM64 server, use `--platform linux/arm64` instead. Cross-platform builds require Docker's emulation support.

To run the image locally, complete the authentication setup above, set `IMAGE=gedenkseite:local` and `SITE_ORIGIN=http://localhost:4321` in `.env`, then run:

```sh
docker compose --env-file .env up -d
```

Open `http://localhost:4321`. Rebuild the image after changing content or images, then recreate the container with `docker compose --env-file .env up -d --force-recreate`.

### Push to Docker Hub

Create a **private** repository named `gedenkseite` in your Docker Hub account before pushing: the image contains private photos and metadata. Replace `YOUR_DOCKERHUB_USER` with your account name and choose a release tag (the examples use `1.0.0`).

```sh
docker login --username YOUR_DOCKERHUB_USER
docker tag gedenkseite:local YOUR_DOCKERHUB_USER/gedenkseite:1.0.0
docker push YOUR_DOCKERHUB_USER/gedenkseite:1.0.0
```

When prompted, enter a Docker Hub access token with push permission. See Docker's [repository setup](https://docs.docker.com/docker-hub/repos/create/) and [image push instructions](https://docs.docker.com/docker-hub/repos/manage/hub-images/push/).

### Push to GitHub Container Registry (GHCR)

Create a GitHub personal access token **(classic)** with `write:packages` permission. If your organization requires SSO, authorize the token for that organization. Replace `YOUR_GITHUB_USER` with your login and `YOUR_NAMESPACE` with your lowercase GitHub account or organization name.

```sh
docker login ghcr.io --username YOUR_GITHUB_USER
docker tag gedenkseite:local ghcr.io/YOUR_NAMESPACE/gedenkseite:1.0.0
docker push ghcr.io/YOUR_NAMESPACE/gedenkseite:1.0.0
```

Enter the token at the password prompt. GHCR creates new packages as private by default; verify that the package remains **private** and grant access only to the intended users. See GitHub's [Container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

### Pull and run on the server

Log in to the chosen registry on the server. For Docker Hub, use a token with pull permission; for GHCR, use a classic token with `read:packages`. Copy the Compose file and create a server-specific `.env` using the authentication setup above. Set `SITE_ORIGIN` to the site's browser address and `IMAGE` to the full image name you pushed, for example:

```dotenv
# Docker Hub:
IMAGE=YOUR_DOCKERHUB_USER/gedenkseite:1.0.0
# Or GHCR (use only one IMAGE line):
# IMAGE=ghcr.io/YOUR_NAMESPACE/gedenkseite:1.0.0
```

Then start or update the site:

```sh
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

Use a new release tag for each build and update `IMAGE` on the server before pulling. Authentication credentials remain runtime values and are not embedded in the site build.
