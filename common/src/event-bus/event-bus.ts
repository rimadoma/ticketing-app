import { connect, type AmqpConnectionManager } from 'amqp-connection-manager';
import type { z } from 'zod';
import type Event from './events/event.js';
import type Publisher from './publisher.js';
import type Listener from './listener.js';

export default class EventBus {
    private readonly publishers: Publisher<Event<z.ZodType>>[] = [];
    private readonly listeners: Listener<Event<z.ZodType>>[] = [];

    private constructor(
        private readonly connection: AmqpConnectionManager,
        private readonly serviceName: string,
    ) {}

    static async create(
        serviceName: string,
        url: string = process.env.RABBITMQ_URL ?? 'amqp://rabbitmq-service',
    ): Promise<EventBus> {
        const connection = connect(url);
        await connection.connect();
        return new EventBus(connection, serviceName);
    }

    async addPublishers(...publishers: Publisher<Event<z.ZodType>>[]): Promise<void> {
        for (const publisher of publishers) {
            await publisher.connect(this.connection, this.serviceName);
            this.publishers.push(publisher);
        }
    }

    async addListeners(...listeners: Listener<Event<z.ZodType>>[]): Promise<void> {
        for (const listener of listeners) {
            await listener.connect(this.connection, this.serviceName);
            await listener.listen();
            this.listeners.push(listener);
        }
    }

    async close(): Promise<void> {
        for (const publisher of this.publishers) await publisher.close();
        for (const listener of this.listeners) await listener.close();
        await this.connection.close();
    }
}
