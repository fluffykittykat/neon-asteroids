# Deploying Neon Asteroids to Google Cloud Run

**Project:** `astroids-3a3fb`
**Service:** `neon-asteroids`
**Region:** `us-central1`
**Live URL:** https://neon-asteroids-210721664554.us-central1.run.app
**Custom domain:** `neon-asteroids.izzytchai.com`

## Prerequisites

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud` CLI).
2. Authenticate and set the project:
   ```sh
   gcloud auth login
   gcloud config set project astroids-3a3fb
   ```
3. Enable required services (one-time):
   ```sh
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```

## Quick Deploy

From the project root:

```sh
gcloud run deploy neon-asteroids \
  --source . \
  --port 8080 \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars VITE_GEMINI_API_KEY=YOUR_KEY_HERE
```

Cloud Build will use the `Dockerfile` to build a two-stage image (`node:20-slim` for the build, `nginx:alpine` for serving) and deploy it to Cloud Run.

## How the Runtime Environment Works

`VITE_GEMINI_API_KEY` is **not** a build-time variable. It is injected at container startup:

1. Cloud Run passes the env var to the container.
2. `docker-entrypoint.sh` writes it into `/usr/share/nginx/html/env-config.js` as `window.env`.
3. The app reads `window.env.VITE_GEMINI_API_KEY` at runtime.
4. `nginx.conf` sets `Cache-Control: no-store` on `env-config.js` so the value is never cached.

This means you can change the API key without rebuilding the image.

## Updating Env Vars Without Rebuilding

To change `VITE_GEMINI_API_KEY` (or add new env vars) without a rebuild:

```sh
gcloud run services update neon-asteroids \
  --region us-central1 \
  --set-env-vars VITE_GEMINI_API_KEY=NEW_KEY_HERE
```

This triggers a new revision with the updated environment. No image rebuild needed.

## Custom Domain Setup

`neon-asteroids.izzytchai.com` points to Cloud Run via a CNAME record.

1. In your DNS provider, add a CNAME record:
   ```
   neon-asteroids.izzytchai.com  CNAME  neon-asteroids-210721664554.us-central1.run.app.
   ```
2. Map the domain in Cloud Run:
   ```sh
   gcloud run domain-mappings create \
     --service neon-asteroids \
     --domain neon-asteroids.izzytchai.com \
     --region us-central1
   ```
3. Cloud Run provisions a managed TLS certificate automatically.

**Important:** If you add a new domain, you must also add it to the Gemini API key's allowed HTTP referrers. See the Troubleshooting section below.

## Local Development with Docker

Using Docker Compose:

```sh
# Set the API key in your environment (or create a .env file)
export VITE_GEMINI_API_KEY=your_key_here

# Build and run
docker compose up --build
```

The game will be available at `http://localhost:8080`.

To stop: `docker compose down`

## Firebase Configuration

Firebase config is hardcoded in `AuthService.js`. The Firebase API key is not secret -- it is restricted by domain in the Firebase Console. An optional env var override (`VITE_FIREBASE_API_KEY`) exists but is not required for deployment.

## Troubleshooting

### Node version errors during build

The Dockerfile uses `node:20-slim`. The Firebase SDK requires Node >= 20. If you see build errors related to Node version compatibility, make sure you have not changed the base image to an older version.

### Gemini API key errors / 403 responses

The Gemini API key has HTTP referrer restrictions. Allowed referrers must include every domain that serves the app. To update:

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials?project=astroids-3a3fb).
2. Find the Gemini API key.
3. Under "Application restrictions > HTTP referrers", add the new domain (e.g., `https://new-domain.example.com/*`).

Current referrers should include:
- `https://neon-asteroids-210721664554.us-central1.run.app/*`
- `https://neon-asteroids.izzytchai.com/*`
- `http://localhost:8080/*` (for local dev)

### Build failures

Check Cloud Build logs linked in the deploy output, or view them with:

```sh
gcloud builds list --limit=5 --project=astroids-3a3fb
gcloud builds log BUILD_ID --project=astroids-3a3fb
```

### Port issues

The container must listen on port 8080. This is configured in `nginx.conf` and exposed in the `Dockerfile`. Cloud Run expects port 8080 as specified in the deploy command.
