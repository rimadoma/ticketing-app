import { describe, it, expect } from 'vitest';
import Publisher from '../../src/event-bus/publisher.js';
import { Routes } from '../../src/event-bus/routes.js';
import type { TicketCreatedEvent } from '../../src/event-bus/events/ticket-created-event.js';
import { buildFakeConnection, buildTicketData } from './fake-amqp.js';

class TestPublisher extends Publisher<TicketCreatedEvent> {
    protected readonly route = Routes.TICKET_CREATED;
}

describe('Publisher', () => {
    it('asserts the topic exchange derived from the route', async () => {
        const publisher = new TestPublisher();
        const { connection, rawChannel } = buildFakeConnection();

        await publisher.connect(connection);

        expect(rawChannel.assertExchange).toHaveBeenCalledWith('ticket', 'topic', { durable: true });
    });

    it('publishes serialized with expected exhange and route', async () => {
        const publisher = new TestPublisher();
        const { connection, wrapper } = buildFakeConnection();
        await publisher.connect(connection);

        const data = buildTicketData();
        await publisher.publish(data);

        expect(wrapper.publish).toHaveBeenCalledWith(
            'ticket',
            'ticket.created',
            Buffer.from(JSON.stringify(data)),
            { persistent: true },
        );
    });

    it('throws if publish is called before connect', async () => {
        const publisher = new TestPublisher();

        await expect(publisher.publish(buildTicketData())).rejects.toThrow(
            "Can't publish without a channel or exchange",
        );
    });
});
