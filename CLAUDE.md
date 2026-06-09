# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A backend-focused microservices ticketing app. Services are independently deployable Node.js/TypeScript apps orchestrated with Kubernetes and Skaffold. All services use Fastify with Zod validation.

## Repository Structure

```
auth/               # Auth service (port 3000) — /api/users/*
common/             # Shared library (@ticketing/common) — published locally via file: reference
infra/
  k8s/              # Local Kubernetes manifests
  k8s-gcp/          # GCP Kubernetes manifests
skaffold.yaml       # Local dev orchestration
docker-compose.yml  # Alternative: run services directly with Docker
```

## Common Commands

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

## Running the Full Stack

**Kubernetes (recommended for integration):**
```bash
skaffold dev          # local cluster — builds images, deploys, watches .ts file changes
skaffold run -p gcp   # one-shot deploy to GCP (no file watching)
```

Skaffold syncs `.ts` source files directly into running containers without a full image rebuild.

**Docker Compose (simpler alternative):**
```bash
docker compose up --build
```

## Architecture

### Shared Library (`common/`)

`@ticketing/common` is consumed by all services via a local `file:` npm reference. It exports:

- **`CustomError`** — abstract base class all custom errors extend. Requires `statusCode` and `serializeErrors()`. The `errorHandler` registered on each Fastify instance handles any `CustomError` subclass polymorphically.
- **`RequestValidationError`** (exported as `ValidationError`) — 400, carries field-level errors.
- **`AppError`** — 500, carries an opaque `errorId` for ops correlation.
- **`schemaErrorFormatter`** — Fastify schema error hook; converts Zod validation failures into `RequestValidationError`.

After changing `common/src/`, always rebuild (`npm run build` in `common/`) before the changes are visible to services — services import from `common/dist/`.

### Service Structure (`auth/` as the reference pattern)

Each service wires up Fastify in `src/index.ts`:
- Registers Zod validator/serializer compilers (`@fastify/type-provider-zod`)
- Registers `schemaErrorFormatter` and `errorHandler` from `@ticketing/common`
- Registers route plugins

Routes define Zod schemas inline or in a sibling `*-schema.ts` / `*-credentials.ts` file. The `Body` generic on route handlers is inferred from the Zod schema (`z.infer<typeof schema.body>`).

### Kubernetes / Ingress

The NGINX Ingress controller routes by path prefix to each service's ClusterIP:

| Path pattern     | Service             | Port |
|------------------|---------------------|------|
| `/api/users/.*`  | `auth-service`      | 3000 |

Each new service needs a Deployment + ClusterIP Service manifest in `infra/k8s/` and a corresponding path rule in `infra/k8s/ingress-srv.yaml`. The GCP equivalents live in `infra/k8s-gcp/` with Artifact Registry image paths.

### TypeScript Configuration

- `"module": "nodenext"` — requires explicit `.js` extensions on all local imports (even `.ts` source files)
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- Do not use `any`
