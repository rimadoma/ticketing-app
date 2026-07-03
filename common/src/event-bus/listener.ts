import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type amqp from 'amqplib';
import { z, type ZodType } from 'zod';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import type Event from './events/event.js';
import { QUEUE_ARGS } from './topology.js';

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
                            const parsed = this.parseMessage(message);
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
