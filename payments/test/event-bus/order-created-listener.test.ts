import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCreatedListener } from '../../src/event-bus/order-created-listener.js';
import { OrderModel } from '../../src/models/order.js';
import { dbInfra } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (orderCreatedListener as unknown as { onMessage(d: object, m: amqp.ConsumeMessage): Promise<void> })
        .onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(overrides: object = {}) {
    return {
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: new mongoose.Types.ObjectId().toHexString(),
        status: OrderStatus.Created,
        ticket: {
            id: new mongoose.Types.ObjectId().toHexString(),
            price: { amount: '49.99', currency: 'EUR' },
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        version: 1,
        ...overrides,
    };
}

describe('OrderCreatedListener', () => {
    it('saves the order to the DB', async () => {
        const data = buildData();

        await onMessage(data);

        const order = await OrderModel.findById(data.id);
        expect(order).not.toBeNull();
        expect(order!.userId).toBe(data.userId);
        expect(order!.status).toBe(data.status);
        expect(order!.price.amount.toString()).toBe(data.ticket.price.amount);
        expect(order!.price.currency).toBe(data.ticket.price.currency);
        expect(order!.version).toBe(data.version);
    });

    it('is idempotent — repeated events do not create duplicate orders', async () => {
        const data = buildData();

        await onMessage(data);
        await onMessage(data);

        expect(await OrderModel.countDocuments({ _id: data.id })).toBe(1);
    });

    it('does nothing if the order already exists', async () => {
        const data = buildData();

        await onMessage(data);
        await onMessage({ ...data, status: OrderStatus.Cancelled });

        expect(await OrderModel.countDocuments({ _id: data.id })).toBe(1);
        const saved = await OrderModel.findById(data.id);
        expect(saved!.status).toBe(OrderStatus.Created);
    });
});
