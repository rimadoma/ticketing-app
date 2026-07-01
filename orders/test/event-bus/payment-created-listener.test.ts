import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { paymentCreatedListener } from '../../src/event-bus/payment-created-listener.js';
import { OrderModel, OrderStatus } from '../../src/models/order.js';
import { createOrder, dbInfra } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (paymentCreatedListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

function paymentEvent(orderId: string) {
    return { id: 'pi_test123', orderId, version: 1, price: { amount: '10.00', currency: 'EUR' } };
}

describe('PaymentCreatedListener', () => {
    it.each([OrderStatus.Created, OrderStatus.AwaitingPayment])(
        'marks a %s order as complete and increments version',
        async (status) => {
            const { id } = await createOrder(status);

            await onMessage(paymentEvent(id));

            const order = await OrderModel.findById(id);
            expect(order!.status).toBe(OrderStatus.Complete);
            expect(order!.version).toBe(2);
        }
    );

    it.each([OrderStatus.Cancelled, OrderStatus.Complete])(
        'does nothing if order status is already %s',
        async (status) => {
            const { id } = await createOrder(status);

            await onMessage(paymentEvent(id));

            const order = await OrderModel.findById(id);
            expect(order!.status).toBe(status);
            expect(order!.version).toBe(1);
        }
    );

    it('does nothing if the order does not exist', async () => {
        await expect(
            onMessage(paymentEvent(new mongoose.Types.ObjectId().toHexString()))
        ).resolves.not.toThrow();
    });

    it('is idempotent — a redelivered event does not double-complete', async () => {
        const { id } = await createOrder();

        await onMessage(paymentEvent(id));
        await onMessage(paymentEvent(id));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Complete);
        expect(order!.version).toBe(2);
    });
});
