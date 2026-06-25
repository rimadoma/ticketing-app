import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type amqp from 'amqplib';
import { z } from 'zod';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import type Event from './events/event.js';

export default abstract class Publisher<T extends Event<z.ZodType>> {
    private channel: ChannelWrapper | null = null;
    private exchangeName: string | null = null;
    protected abstract route: T['route'];

    async connect(connection: AmqpConnectionManager): Promise<void> {
        try {
            const routingKey = this.route.toString();
            this.exchangeName = routingKey.substring(0, routingKey.indexOf('.'));
            const exchangeName = this.exchangeName;
            const queueName = `${routingKey}.queue`;

            this.channel = connection.createChannel({
                setup: async (channel: amqp.ConfirmChannel) => {
                    await channel.assertExchange(exchangeName, 'topic', { durable: true });
                    await channel.assertQueue(queueName, { durable: true });
                    await channel.bindQueue(queueName, exchangeName, routingKey);
                },
            });
            await this.channel.waitForConnect();
        } catch (err) {
            throw new AppError(err, AppErrorIds.EVENT_BUS_CONNECTION_ERROR);
        }
    }

    async publish(data: T['data']): Promise<void> {
        if (!this.channel || !this.exchangeName) {
            throw new Error("Can't publish without a channel or exchange");
        }

        const serializedData = Buffer.from(JSON.stringify(data));
        await this.channel.publish(this.exchangeName, this.route.toString(), serializedData, { persistent: true });
    }

    async close(): Promise<void> {
        await this.channel?.close();
    }
}
