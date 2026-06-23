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

`event-bus` is a **shared Node.js/TypeScript library** (analogous to `common/`) consumed by all backend microservices. It encapsulates the RabbitMQ connection, channel management, publisher, and subscriber so individual services never deal with `amqplib` directly.

## Infrastructure

RabbitMQ runs as a Kubernetes Deployment with a ClusterIP Service in `infra/k8s/`. Services connect to it via the in-cluster DNS name.

## Node.js Client

Uses `amqp-connection-manager` (wraps `amqplib`) for automatic reconnection — important in Kubernetes where pods restart independently.

## Key Concepts

- **Exchange:** topic exchange for routing events by type (e.g. `ticket.created`, `order.cancelled`)
- **Queue:** each subscribing service binds a durable queue to the exchange with a routing key pattern
- **Durability:** queues and messages are durable — RabbitMQ persists them across broker restarts
- **Acknowledgement:** consumers ack only after successful processing; unacked messages are requeued on crash

## Known Gap: Event Replay

RabbitMQ is queue-based — messages are removed once consumed. NATS Streaming is log-based and supports replaying from a start position (beginning of channel, specific sequence number, time delta, etc.). This gap surfaces when:

- A new service instance starts and needs to catch up on past events
- The course uses start positions to bootstrap subscriber state

**Options under consideration:**

| Option | Trade-off |
|---|---|
| **RabbitMQ Streams** | Native log semantics with offset-based replay; requires `rabbitmq_stream` plugin and a different client (`rabbitmq-stream-js-client`). Steeper setup but keeps everything in one broker. |
| **Redis event store** | Publish events to a Redis list/stream (`XADD`/`XREAD`) before (or after) RabbitMQ. Replay by reading from Redis. Adds a second storage dependency but Redis is already on the stack. |

Decision pending — revisit when the course introduces start positions.
