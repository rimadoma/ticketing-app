# Event Bus Architecture

## Decision: RabbitMQ

RabbitMQ is the message broker for all inter-service events in this project.

**Alternatives considered:**

| Option | Reason rejected |
|---|---|
| NATS Streaming Server | Deprecated; course uses it but it's end-of-life |
| NATS JetStream | Successor to NATS Streaming — least friction from course, but limited real-world exposure |
| Redis Pub/Sub | No message persistence or delivery guarantees |

RabbitMQ was chosen for its prevalence in real-world production systems, making it the better learning investment.

## Role in the Architecture

`event-bus` is a **shared Node.js/TypeScript library code** within `common/` consumed by all backend microservices. It encapsulates the connection (`EventBus` facade), channel management, publisher, and subscriber. It hosts message schemas and event types. Individual services implement their desired publishers and listeners and register them with an `EventBus` instance, which owns the connection on their behalf.

## Infrastructure

RabbitMQ runs as a Kubernetes Deployment with a ClusterIP Service in `infra/k8s/`. Services connect to it via the in-cluster DNS name.

**PersistentVolumeClaim:** The current manifest has no PVC, so `/var/lib/rabbitmq` lives in ephemeral container storage. Durable queues and persistent messages survive a container restart within the same pod, but are lost when the pod is deleted and recreated (node failure, rolling update, manual delete). For production, add a PVC mounted at `/var/lib/rabbitmq`. For local dev with Skaffold this is tolerable — lost messages can be retried manually.

## Node.js Client

Uses `amqp-connection-manager` as the primary client, with `amqplib` as a peer dependency used only for channel setup types (`amqp.ConfirmChannel`). `amqp-connection-manager` handles reconnection and publish queuing transparently — `publish()` waits for the broker to come back and ACK the message (publisher confirms) before resolving.

## Connection Model

Each service process holds one TCP connection to RabbitMQ. Publishers and listeners each get their own `ChannelWrapper` on that shared connection — channels are cheap, connections are not.

The connection is owned by the **`EventBus` facade** (`common/src/event-bus/event-bus.ts`), a broker-agnostic wrapper so services never import `amqp-connection-manager` directly. A service builds one bus in its entry point with `await EventBus.create(url)`, then registers its publishers/listeners with `addPublishers(...)` / `addListeners(...)` — the bus connects each on the shared connection (and starts listeners). `EventBus.close()` tears down all channels, then the connection. Shutdown order in `src/index.ts`: close the Fastify app → `eventBus.close()` → disconnect from MongoDB.

Connection isolation comes from `EventBus` being a **class, not a shared instance**: each service constructs its own bus in its own process, so each gets its own connection. `common/` exports the class only — never a pre-built instance.

## Schema Registry

Event schemas are defined as Zod schemas in `common/src/event-bus/schemas/` and are the single source of truth for both TypeScript types and runtime validation. Event interfaces in `common/src/event-bus/events/` reference these schemas via the generic `Event<TSchema extends z.ZodType>`.

Listeners validate every incoming message against the schema before passing data to `onMessage()` — a malformed message throws a Zod parse error and the message is nacked.

## Key Concepts

- **Exchange:** topic exchange for routing events by type (e.g. `ticket.created`, `order.cancelled`)
- **Queue:** each subscribing service binds a durable queue to the exchange with a routing key pattern
- **Durability:** queues and messages are durable — RabbitMQ persists them across broker restarts
- **Acknowledgement:** consumers ack only after successful processing; unacked messages are requeued on crash

## Topology Bootstrap

**Problem.** A topic exchange has no memory: it drops any message that routes to no *currently-bound* queue. Because queue creation was originally the listener's responsibility (each listener asserted and bound its own queue on `connect()`), any event published before a consumer had ever connected was silently lost. Under Skaffold all services come up together so the window is brief, but "brief" still loses messages — and the gap is wide open the moment a *new* consumer is added to an already-running system.

**Decision.** Declare the full exchange/queue/binding topology up front, so every queue exists and is bound before any producer publishes. The topology is declared **at the broker** via a `definitions.json` loaded at RabbitMQ startup (`load_definitions`), rather than by application code. Queues and bindings therefore exist the moment the broker is ready — before any service connects — with no first-boot race and no topology logic in the services. The `rabbitmq:4-management` image already ships the management plugin that performs the import, so no new components are needed. (This replaced an earlier app-side approach where `EventBus.create()` asserted the topology from an `EVENT_BUS_TOPOLOGY` env var on connect; moving it to the broker removed the app coupling and the dependency on some service booting before the first publish.)

**Config format.** `definitions.json` (in the `rabbitmq-config` ConfigMap) lists each exchange (`topic`, durable), each durable queue with its `x-message-ttl`, and one binding per queue with `routing_key = ${exchange}.${suffix}`. Queue names keep the existing `${service}.${exchange}.${suffix}` convention (e.g. `expiration.order.created`), matching what `listener.ts` asserts. Because `load_definitions` suppresses default-user creation on a fresh node, the file must **also** declare the vhost `/`, the `guest` user (with `password_hash`), and its permissions — otherwise a fresh broker has no login and every service is locked out. `loopback_users = none` (in the sibling `20-definitions.conf`) lets `guest` connect from other pods, which the services rely on (`amqp://rabbitmq-service`, no credentials).

**Delivery.** The `rabbitmq-config` ConfigMap carries both files and is mounted into the RabbitMQ container via `subPath` (`/etc/rabbitmq/definitions.json` and `/etc/rabbitmq/conf.d/20-definitions.conf`) so it does not shadow the image's `/etc/rabbitmq/enabled_plugins`. There is one ConfigMap per environment (`infra/k8s/`, `infra/k8s-gcp/`). A ConfigMap edit is picked up only on broker restart — acceptable, since a topology change needs a broker bounce anyway.

**Fallback.** Listeners still assert and bind their own queue on `connect()`, exactly as before the broker took over. If the broker ever came up without the definitions, a listener self-provisions its queue as soon as it connects — so the broker declaration is additive, not a hard dependency.

**Message TTL.** Pre-declaring durable queues means a queue whose consumer is never deployed would accumulate messages forever. To bound this, every queue carries a shared `x-message-ttl` (7 days). The value lives in **two** places that must stay identical — `definitions.json` and the listener's `assertQueue` (the `QUEUE_ARGS` const in `listener.ts`) — because RabbitMQ rejects redeclaring a durable queue with different arguments (`PRECONDITION_FAILED`). This duplication is unavoidable across the JSON/TS boundary; keep them in sync.

**Migration note.** Because existing durable queues are redeclared with the new `x-message-ttl`, any queue that already exists *without* it must be deleted before rollout or the redeclaration fails with `PRECONDITION_FAILED`. Local RabbitMQ is ephemeral (no PVC — see [Infrastructure](#infrastructure)), so a pod restart clears it. The GCP manifest mounts a PVC, so its queues survive restarts and must be deleted explicitly (management UI or `rabbitmqctl delete_queue`) on the first deploy of this change.

## Event Replay

RabbitMQ is queue-based — messages are removed once consumed. The current approach uses durable queues, which cover the primary operational need: if a service pod restarts, its durable queue holds unacked messages until the consumer reconnects (`amqp-connection-manager` handles reconnection automatically). Messages are also persisted on a volume so that if RabbitMQ goes down they don't disappear from the queue.

**Not covered:** a brand-new service instance that needs to replay history to build initial state (the start-position pattern from NATS Streaming). If that becomes necessary, the path forward is **RabbitMQ Streams** — native log semantics with offset-based replay, `rabbitmq_stream` plugin, and the `rabbitmq-stream-js-client` Node.js client. Redis as a second event store was considered and rejected as unnecessary overhead for this use case.

**Known limitation — dual-write:** there is a gap between a successful DB write and the `publish()` call in a route handler. A crash in that window leaves the DB updated but the event undelivered. On restart the pod has no record of the unsent event. The fix is the **outbox pattern**: write the pending event to a MongoDB collection in the same transaction as the domain write, then have a background worker publish from the outbox and mark records complete only after a broker ACK. This is not yet implemented — see the `// TODO: outbox pattern` comments in the ticket routes.

The event-bus library abstracts the broker details, so a future switch to Streams would be contained to this library without touching service code.
