import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type amqp from 'amqplib';
import { z, type ZodType } from 'zod';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import type Event from './events/event.js';

/**
 * Queues are declared up front by the broker's `definitions.json` (see the
 * `rabbitmq-config` ConfigMap in `infra/k8s*`), which sets this same
 * `x-message-ttl`. A listener re-declares its own queue on connect as a
 * fallback, so its `assertQueue` args **must** match the broker's or RabbitMQ
 * rejects the redeclaration with `PRECONDITION_FAILED`. Keep this value in sync
 * with the `x-message-ttl` in that ConfigMap.
 */
const QUEUE_ARGS: Record<string, unknown> = { 'x-message-ttl': 7 * 24 * 60 * 60 * 1000 }; // 7 days

export default abstract class Listener<T extends Event<z.ZodType>> {
    private channel: ChannelWrapper | null = null;
    private queueName: string | null = null;
    protected abstract route: T['route'];
    protected abstract schema: ZodType<T['data']>;
    protected abstract readonly serviceName: string;

    async connect(connection: AmqpConnectionManager): Promise<void> {
        try {
            const routingKey = this.route.toString();
            const exchangeName = routingKey.substring(0, routingKey.indexOf('.'));
            this.queueName = `${this.serviceName}.${routingKey}`;
            const queueName = this.queueName;

            this.channel = connection.createChannel({
                setup: async (channel: amqp.ConfirmChannel) => {
                    await channel.assertExchange(exchangeName, 'topic', { durable: true });
                    await channel.assertQueue(queueName, { durable: true, arguments: QUEUE_ARGS });
                    await channel.bindQueue(queueName, exchangeName, routingKey);
                    await channel.consume(
                        queueName,
                        (message) => {
                            if (!message) return;
                            let parsed: T['data'];
                            try {
                                parsed = this.parseMessage(message);
                            } catch (err) {
                                // A malformed or schema-invalid message can never succeed, so
                                // ack it (don't requeue) to stop it bouncing back and forth forever.
                                console.error(`Discarding unparseable message on queue ${queueName}`, err);
                                this.channel!.ack(message);
                                return;
                            }
                            this.onMessage(parsed, message)
                                .then(() => this.channel!.ack(message))
                                .catch(() => this.channel!.nack(message, false, true));
                        },
                        { noAck: false },
                    );
                },
            });
            await this.channel.waitForConnect();
        } catch (err) {
            throw new AppError(err, AppErrorIds.EVENT_BUS_CONNECTION_ERROR);
        }
    }

    private parseMessage(message: amqp.ConsumeMessage): T['data'] {
        return this.schema.parse(JSON.parse(message.content.toString('utf-8')));
    }

    protected abstract onMessage(data: T['data'], msg: amqp.ConsumeMessage): Promise<void>;

    async close(): Promise<void> {
        await this.channel?.close();
    }
}
