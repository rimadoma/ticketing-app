import amqp from 'amqplib';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import { Routes } from './routes.js';
import type Event from './event.js';
import type { TicketCreatedEvent } from './ticket-created-event.js';

export default abstract class Listener<T extends Event> {
    private connection: amqp.ChannelModel | null = null;
    private channel: amqp.Channel | null = null;
    protected abstract route: T['route'];
    private queueName: string | null = null;

    async connect() {
        try {
            this.connection = await amqp.connect('amqp://rabbitmq-service');
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

    private parseMessage(message: amqp.ConsumeMessage): unknown {
        const contents = message.content;
        return JSON.parse(contents.toString('utf-8'));
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

class TicketCreatedListener extends Listener<TicketCreatedEvent> {
    protected readonly route: Routes.TICKET_CREATED = Routes.TICKET_CREATED;

    protected onMessage(data: TicketCreatedEvent['data'], msg: amqp.ConsumeMessage): Promise<void> {
        throw new Error('Method not implemented.');
    }

}