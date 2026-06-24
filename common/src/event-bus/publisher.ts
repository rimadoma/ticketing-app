import amqp from 'amqplib';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import type Event from './event.js';

export default abstract class Publisher<T extends Event> {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    protected abstract route: T['route'];
    private exchangeName: string | null = null;

    async connect() {
        try {
            this.connection = await amqp.connect('amqp://rabbitmq-service');
            this.channel = await this.connection.createChannel();
            const routingKey = this.route.toString();
            this.exchangeName = routingKey.substring(0, routingKey.indexOf('.'));
            const queueName = `${routingKey}.queue`;
            await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
            // Ensure a durable queue so that messages persist even if there are no consumers yet
            await this.channel.assertQueue(queueName, { durable: true });
            await this.channel.bindQueue(queueName, this.exchangeName, routingKey);
        } catch (err) {
            throw new AppError(err, AppErrorIds.EVENT_BUS_CONNECTION_ERROR);
        }
    }

    async publish(data: T['data']): Promise<void> {
        if (!this.channel || !this.exchangeName) {
            throw new Error("Can't publish without a channel or exchange");
        }

        this.channel.publish(this.exchangeName, this.route.toString(), Buffer.from(JSON.stringify(data)), { persistent: true });
    }

    async close(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
        }

        if (this.connection) {
            await this.connection.close();
        }
    }
}