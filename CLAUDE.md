# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A microservices ticketing app. Backend services are independently deployable Node.js/TypeScript apps using Fastify with Zod validation. The frontend is a plain JavaScript Next.js app (Pages Router). All services are orchestrated with Kubernetes and Skaffold.

## Repository Structure

```
auth/               # Auth service (port 3000) — /api/users/*
client/             # Next.js frontend (port 3000) — catch-all /
common/             # Shared library (@ticketing/common) — published locally via file: reference
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

All Docker images must be built from the **repo root**, not from within a service directory — Dockerfiles reference sibling directories (`auth/`, `client/`, `common/`):

```bash
docker build -t richdgo4/auth   -f auth/Dockerfile   .
docker build -t richdgo4/client -f client/Dockerfile .
```

A single `.dockerignore` at the repo root covers all services. Do not add per-service `.dockerignore` files.

## Running the Full Stack

**Kubernetes (recommended for integration):**
```bash
skaffold dev          # local cluster — builds images, deploys, watches for file changes
skaffold run -p gcp   # one-shot deploy to GCP (no file watching)
```

Skaffold syncs source files directly into running containers without a full image rebuild:
- Backend services (`.ts`): `auth/src/**/*.ts`
- Frontend (`client/`): `client/pages/**/*.js`

## Architecture

### Shared Library (`common/`)

`@ticketing/common` is consumed by all services via a local `file:` npm reference. It exports:

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
- Registers `schemaErrorFormatter` and `errorHandler` from `@ticketing/common`
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
