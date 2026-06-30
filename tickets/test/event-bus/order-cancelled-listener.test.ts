import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCancelledListener } from '../../src/event-bus/order-cancelled-listener.js';
import { ticketUpdatedPublisher } from '../../src/event-bus/ticket-updated-publisher.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra, createReservedTicket } from '../test-utils.js';

dbInfra();

beforeAll(() => {
    vi.spyOn(ticketUpdatedPublisher, 'publish').mockResolvedValue(undefined);
});

beforeEach(() => {
    vi.clearAllMocks();
});

function onMessage(data: object) {
    return (orderCancelledListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(ticketId: string, orderId: string, overrides: object = {}) {
    return {
        id: orderId,
        userId: new mongoose.Types.ObjectId().toHexString(),
        status: OrderStatus.Cancelled,
        ticketId: ticketId,
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

    it('increments the ticket version', async () => {
        const ticket = await createReservedTicket();

        await onMessage(buildData(ticket.id, RESERVING_ORDER_ID));

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.version).toBe(2);
    });

    it('publishes ticket.updated with the updated ticket data', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, RESERVING_ORDER_ID);

        await onMessage(data);

        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledOnce();
        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledWith(
            expect.objectContaining({ id: ticket.id, version: 2, reservingOrderId: null })
        );
    });

    it('does not clear reservingOrderId if the order does not match', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, new mongoose.Types.ObjectId().toHexString());

        await onMessage(data);

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.reservingOrderId).toBe(RESERVING_ORDER_ID);
    });

    it('does not publish if the order does not match', async () => {
        const ticket = await createReservedTicket();

        await onMessage(buildData(ticket.id, new mongoose.Types.ObjectId().toHexString()));

        expect(ticketUpdatedPublisher.publish).not.toHaveBeenCalled();
    });

    it('does nothing if the ticket does not exist', async () => {
        const missingId = new mongoose.Types.ObjectId().toHexString();

        await onMessage(buildData(missingId, RESERVING_ORDER_ID));

        expect(await TicketModel.exists({ _id: missingId })).toBeNull();
    });

    it('does not publish if the ticket does not exist', async () => {
        await onMessage(buildData(new mongoose.Types.ObjectId().toHexString(), RESERVING_ORDER_ID));

        expect(ticketUpdatedPublisher.publish).not.toHaveBeenCalled();
    });

    it('is idempotent — redelivery of the same event leaves the ticket unreserved', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, RESERVING_ORDER_ID);

        await onMessage(data);
        await onMessage(data);

        const updated = await TicketModel.findById(ticket.id);
        expect(updated!.reservingOrderId).toBeNull();
    });

    it('is idempotent — redelivery does not publish a second event', async () => {
        const ticket = await createReservedTicket();
        const data = buildData(ticket.id, RESERVING_ORDER_ID);

        await onMessage(data);
        await onMessage(data);

        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledOnce();
    });
});
