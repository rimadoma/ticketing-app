import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCancelledListener } from '../../src/event-bus/order-cancelled-listener.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra, createReservedTicket } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (orderCancelledListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(ticketId: string, orderId: string, overrides: object = {}) {
    return {
        id: orderId,
        userId: new mongoose.Types.ObjectId().toHexString(),
        status: OrderStatus.Cancelled,
        ticket: {
            id: ticketId,
            price: { amount: '49.99', currency: 'EUR' },
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        version: 1,
        ...overrides,
    };
}

const RESERVING_ORDER_ID = '000000000000000000000001';

describe('OrderCancelledListener', () => {
    it('clears reservingOrderId when the order matches', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, RESERVING_ORDER_ID);

        await onMessage(data);

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.reservingOrderId).toBeNull();
    });

    it('does not clear reservingOrderId if the order does not match', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, new mongoose.Types.ObjectId().toHexString());

        await onMessage(data);

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.reservingOrderId).toBe(RESERVING_ORDER_ID);
    });

    it('does nothing if the ticket does not exist', async () => {
        const missingId = new mongoose.Types.ObjectId().toHexString();

        await onMessage(buildData(missingId, RESERVING_ORDER_ID));

        expect(await TicketModel.exists({ _id: missingId })).toBeNull();
    });

    it('is idempotent — redelivery of the same event leaves the ticket unreserved', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, RESERVING_ORDER_ID);

        await onMessage(data);
        await onMessage(data);

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.reservingOrderId).toBeNull();
    });
});
