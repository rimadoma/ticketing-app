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

**Decision.** Declare the full exchange/queue/binding topology up front, so every queue exists and is bound before any producer publishes. `EventBus.create()` reads the topology from an env var and asserts every exchange, queue, and binding as a side effect of connecting. This is deliberately encapsulated in the library: services still just call `EventBus.create()` as before and have no knowledge that connecting is what materializes the topology. Assertion is idempotent, so whichever service boots first creates everything and the rest re-assert harmlessly — "first service wins" is an emergent property, not a role any service is assigned.

**Config format.** The `EVENT_BUS_TOPOLOGY` env var holds a `;`-separated list of `service,exchange,suffix` rows (e.g. `orders,ticket,created;orders,ticket,updated`). Everything else is *joined*, never parsed:

- route = `${exchange}.${suffix}` (e.g. `order.created`)
- queue = `${service}.${route}` (e.g. `expiration.order.created`) — the same construction `listener.ts` already uses

The queue name is never split back apart, so there is no ambiguity around dotted service names. The one invariant this bakes in — every routing key is exactly `exchange.suffix`, first segment equal to the exchange — is already load-bearing: `publisher.ts` derives the exchange as the substring of the route before the first dot, so the config cannot drift from it without the publisher also breaking.

Because "first service wins" requires whoever boots first to have the *complete* topology, the full list must reach every event-bus service. It is defined once in an `event-bus-topology` ConfigMap (a single `EVENT_BUS_TOPOLOGY` key) and pulled into each deployment via `envFrom` — define-once, delivered as an ordinary env var, and none of the volume/volumeMount machinery a file-mounted ConfigMap would need. The value is duplicated across the `infra/k8s/` and `infra/k8s-gcp/` ConfigMaps (one per environment), but not across services within an environment.

**Fallback.** If the env var is unset, empty, or entirely malformed, `create()` logs a warning and continues — the system falls back to the original behavior where each listener asserts and binds its own queue on connect (which it still does regardless, as belt-and-suspenders). A missing var degrades to the old cold-start gap rather than failing startup.

**Message TTL.** Pre-declaring durable queues means a queue whose consumer is never deployed would accumulate messages forever. To bound this, every queue is asserted with a shared `x-message-ttl` (`QUEUE_TTL_MS`, 7 days, in `topology.ts`). Crucially, the same `QUEUE_ARGS` are passed by **both** the topology bootstrap and the listener's own `assertQueue` — RabbitMQ rejects redeclaring a durable queue with different arguments (`PRECONDITION_FAILED`), so the two declaration sites must stay identical. This is why the TTL lives in one shared constant.

**Migration note.** Because existing durable queues are redeclared with the new `x-message-ttl`, any queue that already exists *without* it must be deleted before rollout or the redeclaration fails with `PRECONDITION_FAILED`. Local RabbitMQ is ephemeral (no PVC — see [Infrastructure](#infrastructure)), so a pod restart clears it. The GCP manifest mounts a PVC, so its queues survive restarts and must be deleted explicitly (management UI or `rabbitmqctl delete_queue`) on the first deploy of this change.

## Event Replay

RabbitMQ is queue-based — messages are removed once consumed. The current approach uses durable queues, which cover the primary operational need: if a service pod restarts, its durable queue holds unacked messages until the consumer reconnects (`amqp-connection-manager` handles reconnection automatically). Messages are also persisted on a volume so that if RabbitMQ goes down they don't disappear from the queue.

**Not covered:** a brand-new service instance that needs to replay history to build initial state (the start-position pattern from NATS Streaming). If that becomes necessary, the path forward is **RabbitMQ Streams** — native log semantics with offset-based replay, `rabbitmq_stream` plugin, and the `rabbitmq-stream-js-client` Node.js client. Redis as a second event store was considered and rejected as unnecessary overhead for this use case.

**Known limitation — dual-write:** there is a gap between a successful DB write and the `publish()` call in a route handler. A crash in that window leaves the DB updated but the event undelivered. On restart the pod has no record of the unsent event. The fix is the **outbox pattern**: write the pending event to a MongoDB collection in the same transaction as the domain write, then have a background worker publish from the outbox and mark records complete only after a broker ACK. This is not yet implemented — see the `// TODO: outbox pattern` comments in the ticket routes.

The event-bus library abstracts the broker details, so a future switch to Streams would be contained to this library without touching service code.
