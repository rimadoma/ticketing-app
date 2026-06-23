# NATS Streaming → RabbitMQ / Kafka Concept Mapping

Reference for mapping course examples (NATS Streaming) to this project's stack (RabbitMQ), with Kafka as a familiar anchor.

| NATS Streaming | RabbitMQ | Kafka |
|---|---|---|
| **Channel** (named stream) | Exchange + bound Queue(s) | Topic |
| **Subject** (channel name) | Routing key | Topic name (or message key for partition routing) |
| **Publish** | `channel.publish(exchange, routingKey, content)` | `producer.send({ topic, messages })` |
| **Subscribe** | `channel.consume(queue, handler)` | `consumer.subscribe({ topic })` + `consumer.run()` |
| **Durable subscription** | Durable queue (`{ durable: true }`) | Consumer group with committed offsets (durable by default) |
| **Queue group** (load-balanced consumers) | Multiple consumers on the same queue | Consumer group (partitions distributed across members) |
| **Manual ack** (`msg.ack()`) | `channel.ack(msg)` | `resolveOffset()` + `commitOffsets()` (or auto-commit) |
| **AckWait** (redeliver after timeout) | Consumer timeout / message TTL | No direct equivalent — Kafka uses offset commits, not acks |
| **MaxInflight** (unacked message cap) | `channel.prefetch(n)` | `maxInFlightRequests` per producer |
| **ClientID** | Consumer tag | `clientId` + `groupId` |

## The Replay Gap

NATS Streaming is log-based — subscribers can set a **start position** (replay from beginning, a sequence number, a time delta). RabbitMQ is queue-based: messages are gone once consumed. Kafka is log-based like NATS, so start positions map naturally there.

For RabbitMQ, see `arch.md` for the options under consideration (RabbitMQ Streams or Redis event store).
