# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A microservices ticketing app. Backend services are independently deployable Node.js/TypeScript apps using Fastify with Zod validation. The frontend is a plain JavaScript Next.js app (Pages Router). All services are orchestrated with Kubernetes and Skaffold.

## Repository Structure

```
auth/               # Auth service (port 3000) — /api/users/*
client/             # Next.js frontend (port 3000) — catch-all /
common/             # Shared library (@mahonen_consulting_zlc/common) — published locally via file: reference
infra/
  k8s/              # Local Kubernetes manifests
  k8s-gcp/          # GCP Kubernetes manifests
skaffold.yaml       # Local dev orchestration
docker-compose.yml  # Alternative: run services directly with Docker
```

## Common Commands

> **Sandbox note:** Do NOT run `npm` commands — they fail silently and corrupt `node_modules`/`package-lock.json`. Tell the user which package to install and let them run it with `! npm install <pkg>`.

Each service is developed independently. Run these from within the service directory:

```bash
npm install       # install deps (required after changing common/)
npm run dev       # run with tsx watch (hot reload)
npm run build     # compile TypeScript to dist/
```

After modifying `common/`, rebuild it and reinstall in the consuming service:

```bash
cd common && npm run build
cd ../auth && npm install   # re-links the local file: dependency
```

## Docker Builds

`auth/Dockerfile` uses `context: .` (repo root) because it needs access to `common/`. Build it from the repo root:

```bash
docker build -t richdgo4/auth -f auth/Dockerfile .
```

`client/Dockerfile` uses `context: client` — build it from the `client/` directory. Use `Dockerfile.prod` for GCP (runs `next build --webpack && next start`); use the default `Dockerfile` for local dev (runs `next dev --webpack`):

```bash
cd client && docker build -t richdgo4/client .                        # local dev
cd client && docker build -f Dockerfile.prod -t richdgo4/client .     # GCP / production
```

Each has its own `.dockerignore`: the root one covers `auth` (and `common`); `client/.dockerignore` covers the client.

## Running the Full Stack

**Kubernetes (recommended for integration):**
```bash
skaffold dev          # local cluster — builds images, deploys, watches for file changes
skaffold run -p gcp   # one-shot deploy to GCP (no file watching)
```

Skaffold syncs source files directly into running containers without a full image rebuild:
- `auth`: `auth/src/**/*.ts` (context: repo root)
- `client`: `pages/**/*.js` (context: `client/`)

`client` runs webpack (`next dev --webpack`) instead of Turbopack because Skaffold's sync uses `kubectl cp`, which doesn't trigger inotify events. Webpack is configured to poll every 300ms in `next.config.js` so it detects synced files. `next build` also uses `--webpack` (see `package.json`) — the webpack config in `next.config.js` conflicts with Turbopack at build time.

> **Claude Code note:** Claude's file edits also bypass inotify (same mechanism as `kubectl cp`), so Skaffold won't pick them up automatically. After Claude edits a watched file, make a dummy edit (e.g. add/remove a space) to trigger the sync.

## Architecture

### Shared Library (`common/`)

`@mahonen_consulting_zlc/common` is consumed by all services via a local `file:` npm reference. It exports:

- **`CustomError`** — abstract base class all custom errors extend. Requires `statusCode` and `serializeErrors()`. The `errorHandler` registered on each Fastify instance handles any `CustomError` subclass polymorphically.
- **`RequestValidationError`** (exported as `ValidationError`) — 400, carries field-level errors.
- **`AppError`** — 500, carries an opaque `errorId` for ops correlation.
- **`schemaErrorFormatter`** — Fastify schema error hook; converts Zod validation failures into `RequestValidationError`.

After changing `common/src/`, always rebuild (`npm run build` in `common/`) before the changes are visible to services — services import from `common/dist/`.

### Frontend (`client/`)

Next.js Pages Router app in plain JavaScript. Bootstrap CSS is imported globally in `pages/_app.js` — use Bootstrap classes for all styling rather than custom CSS.

### Service Structure (`auth/` as the reference pattern)

Each service wires up Fastify in `src/index.ts`:
- Registers Zod validator/serializer compilers (`@fastify/type-provider-zod`)
- Registers `schemaErrorFormatter` and `errorHandler` from `@mahonen_consulting_zlc/common`
- Registers route plugins

Routes define Zod schemas inline or in a sibling `*-schema.ts` / `*-credentials.ts` file. The `Body` generic on route handlers is inferred from the Zod schema (`z.infer<typeof schema.body>`).

### Kubernetes / Ingress

The NGINX Ingress controller routes by path to each service's ClusterIP:

| Path pattern    | Service          | Port |
|-----------------|------------------|------|
| `/api/users/.*` | `auth-service`   | 3000 |
| `/`             | `client-service` | 3000 |

Rules are evaluated most-specific first. `/` is the catch-all for the Next.js frontend — unknown routes return a 404 from Next.js, not the ingress.

Each new service needs a Deployment + ClusterIP Service manifest in `infra/k8s/` and a corresponding path rule in `infra/k8s/ingress-srv.yaml`. The GCP equivalents live in `infra/k8s-gcp/` with Artifact Registry image paths.

### TypeScript Configuration

- `"module": "nodenext"` — requires explicit `.js` extensions on all local imports (even `.ts` source files)
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- Do not use `any`
