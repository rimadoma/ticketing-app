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

**PersistentVolumeClaim:** The current manifest has no PVC, so `/var/lib/rabbitmq` lives in ephemeral container storage. Durable queues and persistent messages survive a container restart within the same pod, but are lost when the pod is deleted and recreated (node failure, rolling update, manual delete). For production, add a PVC mounted at `/var/lib/rabbitmq`. For local dev with Skaffold this is tolerable — lost messages can be retried manually.

## Node.js Client

Uses `amqplib` with TypeScript types via `@types/amqplib`. If reconnection handling becomes non-trivial, `amqp-connection-manager` is the standard wrapper to add on top.

## Key Concepts

- **Exchange:** topic exchange for routing events by type (e.g. `ticket.created`, `order.cancelled`)
- **Queue:** each subscribing service binds a durable queue to the exchange with a routing key pattern
- **Durability:** queues and messages are durable — RabbitMQ persists them across broker restarts
- **Acknowledgement:** consumers ack only after successful processing; unacked messages are requeued on crash

## Event Replay

RabbitMQ is queue-based — messages are removed once consumed. The current approach uses durable queues, which cover the primary operational need: if a service pod restarts, its durable queue holds unacked messages until the consumer reconnects (`amqp-connection-manager` handles reconnection automatically).

**Not covered:** a brand-new service instance that needs to replay history to build initial state (the start-position pattern from NATS Streaming). If that becomes necessary, the path forward is **RabbitMQ Streams** — native log semantics with offset-based replay, `rabbitmq_stream` plugin, and the `rabbitmq-stream-js-client` Node.js client. Redis as a second event store was considered and rejected as unnecessary overhead for this use case.

The event-bus library abstracts the broker details, so a future switch to Streams would be contained to this library without touching service code.
