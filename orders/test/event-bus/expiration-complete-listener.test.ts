import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { expirationCompleteListener } from '../../src/event-bus/expiration-complete-listener.js';
import { OrderModel, OrderStatus } from '../../src/models/order.js';
import { orderCancelledPublisher } from '../../src/event-bus/order-cancelled-publisher.js';
import { createOrder, dbInfra } from '../test-utils.js';

dbInfra();

beforeAll(() => {
    vi.spyOn(orderCancelledPublisher, 'publish').mockResolvedValue(undefined);
});

beforeEach(() => {
    vi.clearAllMocks();
});

function onMessage(data: object) {
    return (expirationCompleteListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

describe('ExpirationCompleteListener', () => {
    it.each([OrderStatus.Created, OrderStatus.AwaitingPayment])(
        'cancels a %s order, increments version, and publishes order.cancelled',
        async (status) => {
            const { id, ticket } = await createOrder(status);

            await onMessage({ orderId: id, version: 1 });

            const order = await OrderModel.findById(id);
            expect(order!.status).toBe(OrderStatus.Cancelled);
            expect(order!.version).toBe(2);
            expect(orderCancelledPublisher.publish).toHaveBeenCalledOnce();
            expect(orderCancelledPublisher.publish).toHaveBeenCalledWith({
                id,
                userId: expect.any(String),
                status: OrderStatus.Cancelled,
                ticketId: ticket.id,
                expiresAt: expect.any(String),
                version: 2,
            });
        }
    );

    it.each([OrderStatus.Cancelled, OrderStatus.Complete])(
        'does nothing if order status is already %s',
        async (status) => {
            const { id } = await createOrder(status);

            await onMessage({ orderId: id, version: 1 });

            expect(orderCancelledPublisher.publish).not.toHaveBeenCalled();
            const order = await OrderModel.findById(id);
            expect(order!.version).toBe(1);
        }
    );

    it('does nothing if the order does not exist', async () => {
        await onMessage({ orderId: new mongoose.Types.ObjectId().toHexString(), version: 1 });

        expect(orderCancelledPublisher.publish).not.toHaveBeenCalled();
    });

    it('is idempotent — a redelivered event does not double-cancel', async () => {
        const { id } = await createOrder();

        await onMessage({ orderId: id, version: 1 });
        await onMessage({ orderId: id, version: 1 });

        expect(orderCancelledPublisher.publish).toHaveBeenCalledOnce();
        const order = await OrderModel.findById(id);
        expect(order!.version).toBe(2);
    });
});
