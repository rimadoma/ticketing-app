import amqp from 'amqplib';
import { z, type ZodType } from 'zod';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';;
import type Event from './events/event.js';

export default abstract class Listener<T extends Event<z.ZodType>> {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    protected abstract route: T['route'];
    protected abstract schema: ZodType<T['data']>;
    private queueName: string | null = null;

    async connect() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://rabbitmq-service');
            this.channel = await this.connection.createChannel();
            const routingKey = this.route.toString();
            const exchangeName = routingKey.substring(0, routingKey.indexOf('.'));
            this.queueName = `${routingKey}.queue`;
            await this.channel.assertExchange(exchangeName, 'topic', { durable: true });
            await this.channel.assertQueue(this.queueName, { durable: true });
            await this.channel.bindQueue(this.queueName, exchangeName, routingKey);
        } catch (err) {
            throw new AppError(err, AppErrorIds.EVENT_BUS_CONNECTION_ERROR);
        }
    }

    async listen(): Promise<void> {
        if (!this.channel || !this.queueName) {
            throw new Error("Can't listen without a channel or queue");
        }

        await this.channel.consume(
            this.queueName,
            (message) => {
                if (!message) {
                    return;
                }
                const parsed = this.parseMessage(message);
                this.onMessage(parsed, message)
                    .then(() => this.channel!.ack(message))
                    .catch(() => this.channel!.nack(message, false, true));
            },
            { noAck: false },
        );
    }

    private parseMessage(message: amqp.ConsumeMessage): T['data'] {
        const contents = message.content;
        return this.schema.parse(JSON.parse(contents.toString('utf-8')));
    }

    protected abstract onMessage(data: T['data'], msg: amqp.ConsumeMessage): Promise<void>

    async close(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
        }

        if (this.connection) {
            await this.connection.close();
        }
    }
}