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

## Event Replay

RabbitMQ is queue-based — messages are removed once consumed. The current approach uses durable queues, which cover the primary operational need: if a service pod restarts, its durable queue holds unacked messages until the consumer reconnects (`amqp-connection-manager` handles reconnection automatically). Messages are also persisted on a volume so that if RabbitMQ goes down they don't disappear from the queue.

**Not covered:** a brand-new service instance that needs to replay history to build initial state (the start-position pattern from NATS Streaming). If that becomes necessary, the path forward is **RabbitMQ Streams** — native log semantics with offset-based replay, `rabbitmq_stream` plugin, and the `rabbitmq-stream-js-client` Node.js client. Redis as a second event store was considered and rejected as unnecessary overhead for this use case.

**Known limitation — dual-write:** there is a gap between a successful DB write and the `publish()` call in a route handler. A crash in that window leaves the DB updated but the event undelivered. On restart the pod has no record of the unsent event. The fix is the **outbox pattern**: write the pending event to a MongoDB collection in the same transaction as the domain write, then have a background worker publish from the outbox and mark records complete only after a broker ACK. This is not yet implemented — see the `// TODO: outbox pattern` comments in the ticket routes.

The event-bus library abstracts the broker details, so a future switch to Streams would be contained to this library without touching service code.
