import request from 'supertest';
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { app, createJwtCookie, createOrder, createOrders, testInfra } from '../test-utils.js';
import { OrderModel, OrderStatus } from '../../src/models/order.js';
import { orderCancelledPublisher } from '../../src/event-bus/order-cancelled-publisher.js';

const route = (id: string) => `/api/orders/${id}`;

testInfra();

describe('DELETE /api/orders/:id', () => {
    it('returns 401 when not authenticated', async () => {
        await request(app.server)
            .delete(route(new mongoose.Types.ObjectId().toString()))
            .send()
            .expect(401);
    });

    it.each(['abc', 'z'.repeat(24), 'a'.repeat(25)])(
        'returns 400 for invalid id "%s"',
        async (id) => {
            await request(app.server)
                .delete(route(id))
                .set('Cookie', createJwtCookie())
                .send()
                .expect(400);
        }
    );

    it('returns 404 when order does not exist', async () => {
        await request(app.server)
            .delete(route(new mongoose.Types.ObjectId().toString()))
            .set('Cookie', createJwtCookie())
            .send()
            .expect(404);
    });

    it('returns 404 when order belongs to a different user', async () => {
        const orders = await createOrders(1, 'JaneDoe');

        await request(app.server)
            .delete(route(orders[0]!.id))
            .set('Cookie', createJwtCookie('JohnDoe'))
            .send()
            .expect(404);
    });

    it('cancels the order and returns 200', async () => {
        const userId = 'JohnDoe';
        const orders = await createOrders(1, userId);

        const response = await request(app.server)
            .delete(route(orders[0]!.id))
            .set('Cookie', createJwtCookie(userId))
            .send()
            .expect(200);

        expect(response.body.status).toBe(OrderStatus.Cancelled);
        const order = await OrderModel.findById(orders[0]!.id);
        expect(order!.status).toBe(OrderStatus.Cancelled);
        expect(order!.version).toBe(2);

        expect(orderCancelledPublisher.publish).toHaveBeenCalledOnce();
        expect(orderCancelledPublisher.publish).toHaveBeenCalledWith({
            id: orders[0]!.id,
            userId,
            status: OrderStatus.Cancelled,
            ticketId: orders[0]!.ticket.id,
            expiresAt: expect.any(String),
            version: 2,
        });
    });

    it('returns 400 when the order is already complete', async () => {
        const userId = 'JohnDoe';
        const { id } = await createOrder(OrderStatus.Complete, userId);

        await request(app.server)
            .delete(route(id))
            .set('Cookie', createJwtCookie(userId))
            .send()
            .expect(400);

        expect(orderCancelledPublisher.publish).not.toHaveBeenCalled();
    });
});
