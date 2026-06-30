import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCreatedListener } from '../../src/event-bus/order-created-listener.js';
import { ticketUpdatedPublisher } from '../../src/event-bus/ticket-updated-publisher.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra, createTickets } from '../test-utils.js';

dbInfra();

beforeAll(() => {
    vi.spyOn(ticketUpdatedPublisher, 'publish').mockResolvedValue(undefined);
});

beforeEach(() => {
    vi.clearAllMocks();
});

function onMessage(data: object) {
    return (orderCreatedListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(ticketId: string, overrides: object = {}) {
    return {
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: new mongoose.Types.ObjectId().toHexString(),
        status: OrderStatus.Created,
        ticket: {
            id: ticketId,
            price: { amount: '49.99', currency: 'EUR' },
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        version: 1,
        ...overrides,
    };
}

describe('OrderCreatedListener', () => {
    it('sets reservingOrderId on the ticket', async () => {
        const [ticket] = await createTickets(1);
        const data = buildData(ticket!.id);

        await onMessage(data);

        const updated = await TicketModel.findById(ticket!.id);
        expect(updated!.reservingOrderId).toBe(data.id);
    });

    it('increments the ticket version', async () => {
        const [ticket] = await createTickets(1);

        await onMessage(buildData(ticket!.id));

        const updated = await TicketModel.findById(ticket!.id);
        expect(updated!.version).toBe(2);
    });

    it('publishes ticket.updated with the updated ticket data', async () => {
        const [ticket] = await createTickets(1);
        const data = buildData(ticket!.id);

        await onMessage(data);

        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledOnce();
        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledWith(
            expect.objectContaining({ id: ticket!.id, version: 2, reservingOrderId: data.id })
        );
    });

    it('does not create a ticket if one does not exist', async () => {
        const missingId = new mongoose.Types.ObjectId().toHexString();

        await onMessage(buildData(missingId));

        expect(await TicketModel.exists({ _id: missingId })).toBeNull();
    });

    it('does not publish if the ticket does not exist', async () => {
        await onMessage(buildData(new mongoose.Types.ObjectId().toHexString()));

        expect(ticketUpdatedPublisher.publish).not.toHaveBeenCalled();
    });

    it('is idempotent — redelivery of the same event overwrites with the same value', async () => {
        const [ticket] = await createTickets(1);
        const data = buildData(ticket!.id);

        await onMessage(data);
        await onMessage(data);

        const updated = await TicketModel.findById(ticket!.id);
        expect(updated!.reservingOrderId).toBe(data.id);
    });
});
