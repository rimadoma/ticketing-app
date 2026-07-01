import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCancelledListener } from '../../src/event-bus/order-cancelled-listener.js';
import { OrderModel } from '../../src/models/order.js';
import { dbInfra } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (orderCancelledListener as unknown as { onMessage(d: object, m: amqp.ConsumeMessage): Promise<void> })
        .onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(id: string, overrides: object = {}) {
    return {
        id,
        userId: new mongoose.Types.ObjectId().toHexString(),
        status: OrderStatus.Cancelled,
        ticketId: new mongoose.Types.ObjectId().toHexString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        version: 2,
        ...overrides,
    };
}

async function createOrder(id: string, status = OrderStatus.Created, version = 1) {
    return OrderModel.create({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId().toHexString(),
        status,
        price: { amount: '49.99', currency: 'EUR' },
        version,
    });
}

describe('OrderCancelledListener', () => {
    it('sets the order status to Cancelled', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await createOrder(id);

        await onMessage(buildData(id, { version: 2 }));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Cancelled);
        expect(order!.version).toBe(2);
    });

    it('is idempotent — repeated events do not change state', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await createOrder(id);

        await onMessage(buildData(id, { version: 2 }));
        await onMessage(buildData(id, { version: 2 }));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Cancelled);
        expect(order!.version).toBe(2);
    });

    it('ignores a stale event (version < stored version)', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await createOrder(id, OrderStatus.Created, 3);

        await onMessage(buildData(id, { version: 2 }));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Created);
        expect(order!.version).toBe(3);
    });

    it('ignores a same-version event (version === stored version)', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await createOrder(id, OrderStatus.Created, 2);

        await onMessage(buildData(id, { version: 2 }));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Created);
        expect(order!.version).toBe(2);
    });

    it('ignores an already-cancelled order', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await createOrder(id, OrderStatus.Cancelled, 2);

        await onMessage(buildData(id, { version: 3 }));

        const order = await OrderModel.findById(id);
        expect(order!.status).toBe(OrderStatus.Cancelled);
        expect(order!.version).toBe(2);
    });

    it('does nothing if the order does not exist', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();

        await expect(onMessage(buildData(id))).resolves.toBeUndefined();
        expect(await OrderModel.countDocuments({ _id: id })).toBe(0);
    });
});
