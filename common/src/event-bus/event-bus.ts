import { connect, type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type amqp from 'amqplib';
import type { z } from 'zod';
import { AppError } from '../errors/custom-error.js';
import { AppErrorIds } from '../errors/app-error-ids.js';
import type Event from './events/event.js';
import type Publisher from './publisher.js';
import type Listener from './listener.js';
import { loadTopology, QUEUE_ARGS } from './topology.js';

export default class EventBus {
    private readonly publishers: Publisher<Event<z.ZodType>>[] = [];
    private readonly listeners: Listener<Event<z.ZodType>>[] = [];
    private topologyChannel: ChannelWrapper | null = null;

    private constructor(private readonly connection: AmqpConnectionManager) {}

    static async create(
        url: string = process.env.RABBITMQ_URL ?? 'amqp://rabbitmq-service',
    ): Promise<EventBus> {
        const connection = connect(url);
        await connection.connect();
        const bus = new EventBus(connection);
        await bus.assertTopology();
        return bus;
    }

    /**
     * Declares the full exchange/queue/binding topology up front so that
     * durable queues exist and are bound before any producer publishes —
     * closing the cold-start gap where a topic exchange silently drops
     * messages that route to no currently-bound queue. Idempotent, so every
     * connecting service re-asserts harmlessly and whoever boots first wins.
     *
     * The setup runs on a dedicated channel; amqp-connection-manager re-runs
     * it on every reconnect, so the topology also survives a broker restart.
     */
    private async assertTopology(): Promise<void> {
        const topology = loadTopology();
        if (topology.length === 0) {
            console.warn(
                '[event-bus] no queue topology found; queues will be created by listeners on connect',
            );
            return;
        }

        const exchanges = new Set(topology.map((entry) => entry.exchange));
        try {
            const channel = this.connection.createChannel({
                setup: async (channel: amqp.ConfirmChannel) => {
                    for (const exchange of exchanges) {
                        await channel.assertExchange(exchange, 'topic', { durable: true });
                    }
                    for (const { queue, exchange, route } of topology) {
                        await channel.assertQueue(queue, { durable: true, arguments: QUEUE_ARGS });
                        await channel.bindQueue(queue, exchange, route);
                    }
                },
            });
            await channel.waitForConnect();
            this.topologyChannel = channel;
        } catch (err) {
            throw new AppError(err, AppErrorIds.EVENT_BUS_CONNECTION_ERROR);
        }
    }

    async addPublishers(...publishers: Publisher<Event<z.ZodType>>[]): Promise<void> {
        for (const publisher of publishers) {
            await publisher.connect(this.connection);
            this.publishers.push(publisher);
        }
    }

    async addListeners(...listeners: Listener<Event<z.ZodType>>[]): Promise<void> {
        for (const listener of listeners) {
            await listener.connect(this.connection);
            this.listeners.push(listener);
        }
    }

    async close(): Promise<void> {
        for (const publisher of this.publishers) await publisher.close();
        for (const listener of this.listeners) await listener.close();
        await this.topologyChannel?.close();
        await this.connection.close();
    }
}
