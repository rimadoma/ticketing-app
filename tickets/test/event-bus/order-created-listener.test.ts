import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCreatedListener } from '../../src/event-bus/order-created-listener.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra, createTickets } from '../test-utils.js';

dbInfra();

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

    it('does not create a ticket if one does not exist', async () => {
        const missingId = new mongoose.Types.ObjectId().toHexString();

        await onMessage(buildData(missingId));

        expect(await TicketModel.exists({ _id: missingId })).toBeNull();
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
