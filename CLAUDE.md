# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A microservices ticketing app. Backend services are independently deployable Node.js/TypeScript apps using Fastify with Zod validation. The frontend is a plain JavaScript Next.js app (Pages Router). All services are orchestrated with Kubernetes and Skaffold.

## Repository Structure

```
auth/               # Auth service (port 3000) — /api/users/*
client/             # Next.js frontend (port 3000) — catch-all /
common/             # Shared library (@mahonen_consulting_zlc/common) — published to npm
docs/               # Cross-cutting docs (events.md event-flow table, backend-testing-arch.md)
expiration/         # Expiration service — no HTTP routes
hedgehog-consultancy/  # Easter-egg "Hedgehog as a Service" app — GCP only (see Architecture)
orders/             # Orders service (port 3003) — /api/orders/*
payments/           # Payments service (port 3001) — /api/payments
  docs/arch.md      # Stripe integration and idempotency decisions
scripts/            # Repo-wide helper scripts: build-all.sh, test-all.sh, prepare-for-publish.sh
tickets/            # Tickets service (port 3002) — /api/tickets/*
infra/
  k8s/              # Local Kubernetes manifests
  k8s-gcp/          # GCP Kubernetes manifests — only hedgehog.yaml + ingress-srv.yaml are actually deployed (see Hedgehog Consultancy below); the rest are kept for reference
skaffold.yaml       # Local dev orchestration
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

Skaffold syncs source directly into running containers without a full image rebuild (all use repo root as build context): each backend service's `src/**/*.ts` and the client's `pages/**/*.js`. See `skaffold.yaml` for the exact sync rules.

`client` runs webpack (`next dev --webpack`) instead of Turbopack because Skaffold's sync uses `kubectl cp`, which doesn't trigger inotify events. Webpack is configured to poll every 300ms in `next.config.js` so it detects synced files. `next build` also uses `--webpack` (see `package.json`) — the webpack config in `next.config.js` conflicts with Turbopack at build time.

> **Claude Code note:** Claude's file edits also bypass inotify (same mechanism as `kubectl cp`), so Skaffold won't pick them up automatically. After Claude edits a watched file, make a dummy edit (e.g. add/remove a space) to trigger the sync.

## Architecture

### Event Bus (`common/src/event-bus/`)

A shared Node.js/TypeScript library consumed by all backend microservices for event-driven communication. Encapsulates the RabbitMQ connection, channel management, publisher, and subscriber — services never use `amqplib` directly.

**Broker:** RabbitMQ, running as a Kubernetes Deployment + ClusterIP Service in `infra/k8s/`.  
**Client:** `amqp-connection-manager` (auto-reconnect wrapper over `amqplib`).  
**Pattern:** topic exchange — events are routed by type (e.g. `ticket.created`). Each subscribing service consumes from its own durable queue named `${serviceName}.${routingKey}` (e.g. `orders.ticket.created`). Messages and queues are durable; consumers ack only after successful processing.

**Topology bootstrap:** the full exchange/queue/binding topology is declared up front so queues exist and are bound *before* any producer publishes — a topic exchange silently drops messages that route to no currently-bound queue, so a listener that has never connected would otherwise lose events published before its first boot. The topology is declared at the **broker**: a `definitions.json` (in the `rabbitmq-config` ConfigMap, `infra/k8s/rabbitmq-config.yaml`) is loaded at RabbitMQ startup via `load_definitions`, so every exchange, queue, and binding exists the moment the broker is ready — before any service connects, with no app coupling. Listeners still assert+bind their own queue on connect (belt-and-suspenders), so a listener stays self-sufficient. All queues carry a shared `x-message-ttl` (7 days): the value is declared in `definitions.json` **and** passed by the listener's `assertQueue` as `QUEUE_ARGS` (a const in `common/src/event-bus/listener.ts`) — the two **must** match or RabbitMQ rejects the redeclaration with `PRECONDITION_FAILED`, so keep the JSON value and the TS constant in sync.

Because `load_definitions` suppresses default-user creation on a fresh node, `definitions.json` also declares the vhost `/`, the `guest` user (with `password_hash`), and its permissions; `loopback_users = none` (in the same ConfigMap's `20-definitions.conf`) lets services connect as `guest` from other pods (`amqp://rabbitmq-service`, no creds). The config is mounted into the RabbitMQ container via `subPath` so it does not shadow the image's `enabled_plugins`.

When implementing a new `Listener` subclass, you must declare `protected readonly serviceName` — this becomes the queue name prefix and must be unique per consuming service. Add its queue and a binding (routing key `${exchange}.${suffix}`) to `definitions.json` in the `rabbitmq-config` ConfigMap (both `infra/k8s/` and `infra/k8s-gcp/`) so the queue is pre-declared.

See `common/src/event-bus/docs/arch.md` for the full architecture decision record.

### Shared Library (`common/`)

`@mahonen_consulting_zlc/common` is published to npm and consumed by all services. All custom errors extend `CustomError` — throw any subclass from a route and the registered `errorHandler` serializes it correctly.

After changing `common/src/`, always rebuild (`npm run build` in `common/`) before the changes are visible to services — services import from `common/dist/`.

`AppErrorIds` in `common/src/errors/app-error-ids.ts` provides taxonomy constants for `AppError`'s `errorId` parameter — always use these rather than raw numbers. Each maps to a failure class:

| Constant | Use for |
|---|---|
| `DB_CONNECTION_ERROR` | `mongoose.connect()` failure |
| `DB_READ_ERROR` | `find` / `findOne` / `findById` failure |
| `DB_WRITE_ERROR` | `create` / `save` / `update` failure |
| `JWT_SIGN_ERROR` | `jwt.sign()` failure |
| `EVENT_BUS_CONNECTION_ERROR` | `EventBus.create()` / publisher connect failure |
| `STRIPE_API_ERROR` | `stripe.paymentIntents.create()` failure |

If none fit, add a new constant to `app-error-ids.ts` rather than using a raw number.

### Event versioning

Every event schema in `common/src/event-bus/schemas/` carries a `version: z.int32().min(1)` field, starting at **1** and incremented on each change to the underlying record. Publishing it is a producer-side contract (`required` on every event), but how a consumer guards on it depends on *why* it's listening:

- **Replicating another service's data** — e.g. `orders` keeps a local copy of tickets via `ticket-created`/`ticket-updated-listener`. It applies no business logic, just wants the latest snapshot, so it guards on version (`{ version: { $lt: data.version } }`) to avoid overwriting newer data with a stale or reordered event.
- **Transitioning its own aggregate** — e.g. `orders` marking an order `complete` on `payment.created`, or `cancelled` on `expiration.complete`. The guard is a domain rule over the record's own status (skip orders already `cancelled`/`complete`), not version.

Either way, the guard scopes the Mongo write so a stale or duplicate delivery matches nothing and becomes a no-op; when nothing matches, the listener logs a warning and acks — stale events are discarded, not requeued.

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

Each new service that serves HTTP needs a Deployment + ClusterIP Service manifest in `infra/k8s/` and a corresponding path rule in `infra/k8s/ingress-srv.yaml`. A service with no HTTP routes (e.g. `expiration`) needs only a Deployment — no Service, no ingress rule. GCP equivalents with Artifact Registry image paths exist for every service in `infra/k8s-gcp/`, but only `hedgehog-consultancy` is actually deployed there (see below) — the free-tier quota can't host the full stack.

### TypeScript Configuration

- `"module": "nodenext"` — requires explicit `.js` extensions on all local imports (even `.ts` source files)
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- `"verbatimModuleSyntax": true` — use `import type` for type-only imports
- Do not use `any`

### Hedgehog Consultancy (`hedgehog-consultancy/`) — easter egg

A standalone Fastify (TypeScript) app, separate from the ticketing services: **Mähönen Consulting ZLC — "Hedgehog as a Service (HaaS)"**. It serves a tongue-in-cheek "consultation" — with a prickly, snuffle-billed legal disclaimer — at `/api/hedgehog/consult`.

It is **GCP-only**: deployed by `infra/k8s-gcp/hedgehog.yaml` (Deployment + ClusterIP Service on port 3001), built by the `gcp` Skaffold profile, and routed at `/api/hedgehog/consult` in the GCP ingress. It has no `infra/k8s/` manifest and does not run under `skaffold dev`.

It is also the **only** service the `gcp` Skaffold profile builds and deploys. The other services' `infra/k8s-gcp/` manifests still exist but aren't referenced by `skaffold.yaml` — the GCP free-tier quota wasn't enough to host the full stack (auth, client, tickets, orders, payments, their Mongo instances, RabbitMQ), so everything except this easter egg was dropped from GCP to stay within quota. The full stack still runs locally via `skaffold dev`.

It's a silly little easter egg in honour of the plush hedgehog consultant **Mähönen** — also the namesake of the `@mahonen_consulting_zlc` npm scope on the shared library.
