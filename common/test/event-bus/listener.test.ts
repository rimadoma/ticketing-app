import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type amqp from 'amqplib';
import Listener from '../../src/event-bus/listener.js';
import { Routes } from '../../src/event-bus/routes.js';
import { ticketSchema } from '../../src/event-bus/schemas/ticket.js';
import type { TicketCreatedEvent } from '../../src/event-bus/events/ticket-created-event.js';
import { buildFakeConnection, buildTicketData, buildMessage } from './fake-amqp.js';

class TestListener extends Listener<TicketCreatedEvent> {
    protected readonly route = Routes.TICKET_CREATED;
    protected readonly schema = ticketSchema;
    protected readonly serviceName = 'test-service';
    onMessage = vi.fn();
}

describe('Listener', () => {
    it('asserts the topic exchange and durable queue, and binds it to the routing key', async () => {
        const listener = new TestListener();
        const { connection, rawChannel } = buildFakeConnection();

        await listener.connect(connection);

        expect(rawChannel.assertExchange).toHaveBeenCalledWith('ticket', 'topic', { durable: true });
        // 7-day TTL mirrored from the private QUEUE_ARGS constant in listener.ts -- must match
        // the rabbitmq-config ConfigMap's x-message-ttl, or RabbitMQ rejects the redeclaration.
        expect(rawChannel.assertQueue).toHaveBeenCalledWith(
            'test-service.ticket.created',
            { durable: true, arguments: { 'x-message-ttl': 7 * 24 * 60 * 60 * 1000 } },
        );
        expect(rawChannel.bindQueue).toHaveBeenCalledWith('test-service.ticket.created', 'ticket', 'ticket.created');
    });

    it('acks the message once onMessage resolves', async () => {
        const listener = new TestListener();
        listener.onMessage.mockResolvedValue(undefined);
        const { connection, wrapper, deliver } = buildFakeConnection();

        await listener.connect(connection);
        const message = buildMessage(buildTicketData());
        deliver(message);

        await vi.waitFor(() => expect(wrapper.ack).toHaveBeenCalledWith(message));
        expect(wrapper.nack).not.toHaveBeenCalled();
    });

    it('nacks and requeues the message when onMessage throws', async () => {
        const listener = new TestListener();
        listener.onMessage.mockRejectedValue(new Error('boom'));
        const { connection, wrapper, deliver } = buildFakeConnection();

        await listener.connect(connection);
        const message = buildMessage(buildTicketData());
        deliver(message);

        await vi.waitFor(() => expect(wrapper.nack).toHaveBeenCalledWith(message, false, true));
        expect(wrapper.ack).not.toHaveBeenCalled();
    });

    describe('unparseable messages', () => {
        beforeEach(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('acks (without requeue) and logs when the payload is not valid JSON', async () => {
            const listener = new TestListener();
            const { connection, wrapper, deliver } = buildFakeConnection();

            await listener.connect(connection);
            const message = { content: Buffer.from('not json{') } as amqp.ConsumeMessage;
            deliver(message);

            expect(wrapper.ack).toHaveBeenCalledWith(message);
            expect(wrapper.nack).not.toHaveBeenCalled();
            expect(listener.onMessage).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalled();
        });

        it('acks (without requeue) and logs when the payload fails schema validation', async () => {
            const listener = new TestListener();
            const { connection, wrapper, deliver } = buildFakeConnection();

            await listener.connect(connection);
            // Valid JSON, but missing required ticket fields
            const message = buildMessage({ id: 'not-a-hex-id' });
            deliver(message);

            expect(wrapper.ack).toHaveBeenCalledWith(message);
            expect(wrapper.nack).not.toHaveBeenCalled();
            expect(listener.onMessage).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalled();
        });
    });
});
