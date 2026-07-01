# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A microservices ticketing app. Backend services are independently deployable Node.js/TypeScript apps using Fastify with Zod validation. The frontend is a plain JavaScript Next.js app (Pages Router). All services are orchestrated with Kubernetes and Skaffold.

## Repository Structure

```
auth/               # Auth service (port 3000) — /api/users/*
client/             # Next.js frontend (port 3000) — catch-all /
common/             # Shared library (@mahonen_consulting_zlc/common) — published to npm
event-bus/          # Shared RabbitMQ event-bus library — consumed by all backend services
  docs/arch.md      # Architecture decision record
expiration/         # Expiration service — no HTTP routes
orders/             # Orders service (port 3003) — /api/orders/*
payments/           # Payments service (port 3001) — /api/payments
  docs/arch.md      # Stripe integration and idempotency decisions
tickets/            # Tickets service (port 3002) — /api/tickets/*
infra/
  k8s/              # Local Kubernetes manifests
  k8s-gcp/          # GCP Kubernetes manifests
skaffold.yaml       # Local dev orchestration
docker-compose.yml  # Alternative: run services directly with Docker
```

## Common Commands

> **Sandbox note:** Do NOT run any `npm` or `node` commands — they fail and can corrupt /node_modules because you're in a sandbox. Tell the user which command to run and let them execute it with the `!` prefix (e.g. `! npm test`, `! npm install <pkg>`).

Each service is developed independently. Run these from within the service directory:

```bash
npm install       # install deps (required after changing common/)
npm run dev       # run with tsx watch (hot reload)
npm run build     # compile TypeScript to dist/
```

After modifying `common/`, rebuild, bump the version, publish, then reinstall in consuming services:

```bash
cd common && npm run build && npm publish
cd ../auth && npm install
```

## Docker Builds

All images are built from the repo root with a single root `.dockerignore`. Use `client/Dockerfile.prod` for GCP (runs `next build --webpack && next start`); use `client/Dockerfile` for local dev (runs `next dev --webpack`):

```bash
docker build -t richdgo4/auth   -f auth/Dockerfile .
docker build -t richdgo4/client -f client/Dockerfile .               # local dev
docker build -t richdgo4/client -f client/Dockerfile.prod .          # GCP / production
```

## Running the Full Stack

**Kubernetes (recommended for integration):**
```bash
skaffold dev          # local cluster — builds images, deploys, watches for file changes
skaffold run -p gcp   # one-shot deploy to GCP (no file watching)
```

Skaffold syncs source files directly into running containers without a full image rebuild (all use repo root as context):
- `auth`: `auth/src/**/*.ts`
- `tickets`: `tickets/src/**/*.ts`
- `orders`: `orders/src/**/*.ts`
- `expiration`: `expiration/src/**/*.ts`
- `payments`: `payments/src/**/*.ts`
- `client`: `client/pages/**/*.js`

`client` runs webpack (`next dev --webpack`) instead of Turbopack because Skaffold's sync uses `kubectl cp`, which doesn't trigger inotify events. Webpack is configured to poll every 300ms in `next.config.js` so it detects synced files. `next build` also uses `--webpack` (see `package.json`) — the webpack config in `next.config.js` conflicts with Turbopack at build time.

> **Claude Code note:** Claude's file edits also bypass inotify (same mechanism as `kubectl cp`), so Skaffold won't pick them up automatically. After Claude edits a watched file, make a dummy edit (e.g. add/remove a space) to trigger the sync.

## Architecture

### Event Bus (`event-bus/`)

A shared Node.js/TypeScript library consumed by all backend microservices for event-driven communication. Encapsulates the RabbitMQ connection, channel management, publisher, and subscriber — services never use `amqplib` directly.

**Broker:** RabbitMQ, running as a Kubernetes Deployment + ClusterIP Service in `infra/k8s/`.  
**Client:** `amqp-connection-manager` (auto-reconnect wrapper over `amqplib`).  
**Pattern:** topic exchange — events are routed by type (e.g. `ticket.created`). Each subscribing service binds its own durable queue named `${serviceName}.${routingKey}` (e.g. `orders.ticket.created`). Publishers only assert the exchange — queue creation is the listener's responsibility. Messages and queues are durable; consumers ack only after successful processing.

When implementing a new `Listener` subclass, you must declare `protected readonly serviceName` — this becomes the queue name prefix and must be unique per consuming service.

See `event-bus/docs/arch.md` for the full architecture decision record.

### Shared Library (`common/`)

`@mahonen_consulting_zlc/common` is published to npm and consumed by all services. All custom errors extend `CustomError` — throw any subclass from a route and the registered `errorHandler` serializes it correctly.

After changing `common/src/`, always rebuild (`npm run build` in `common/`) before the changes are visible to services — services import from `common/dist/`.

`AppErrorIds` in `common/src/errors/app-error-ids.ts` provides taxonomy constants for `AppError`'s `errorId` parameter. Always use these instead of raw numbers. Current taxonomy:

| Constant | Value | Use for |
|---|---|---|
| `DB_CONNECTION_ERROR` | 1 | `mongoose.connect()` failure |
| `DB_READ_ERROR` | 2 | `find` / `findOne` / `findById` failure |
| `DB_WRITE_ERROR` | 3 | `create` / `save` / `update` failure |
| `JWT_SIGN_ERROR` | 4 | `jwt.sign()` failure |
| `EVENT_BUS_CONNECTION_ERROR` | 5 | `EventBus.create()` / publisher connect failure |
| `STRIPE_API_ERROR` | 6 | `stripe.paymentIntents.create()` failure |

If none of these fit, add a new constant to `app-error-ids.ts` rather than using a raw number.

### Event versioning

Every event payload must include a `version: z.int32().min(1)` field (defined in `ticketSchema` in `common/src/event-bus/schemas/ticket.ts`). Versions start at **1** and increment by 1 with each update. Services use this for optimistic concurrency: a listener rejects (nacks and requeues) any event whose version is not exactly `currentVersion + 1`.

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

| Path pattern      | Service            | Port |
|-------------------|--------------------|------|
| `/api/users/.*`   | `auth-service`     | 3000 |
| `/api/tickets`    | `tickets-service`  | 3002 |
| `/api/tickets/.+` | `tickets-service`  | 3002 |
| `/api/orders`     | `orders-service`   | 3003 |
| `/api/orders/.+`  | `orders-service`   | 3003 |
| `/api/payments`   | `payments-service` | 3001 |
| `/`               | `client-service`   | 3000 |

Rules are evaluated most-specific first. `/` is the catch-all for the Next.js frontend — unknown routes return a 404 from Next.js, not the ingress.

Each new service needs a Deployment + ClusterIP Service manifest in `infra/k8s/` and a corresponding path rule in `infra/k8s/ingress-srv.yaml`. The GCP equivalents live in `infra/k8s-gcp/` with Artifact Registry image paths.

### TypeScript Configuration

- `"module": "nodenext"` — requires explicit `.js` extensions on all local imports (even `.ts` source files)
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- Do not use `any`
