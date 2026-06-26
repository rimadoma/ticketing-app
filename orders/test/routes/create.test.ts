import request from 'supertest';
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { app, createJwtCookie, testInfra } from '../test-utils.js';
import { OrderModel, OrderStatus } from '../../src/models/order.js';
import { TicketModel } from '../../src/models/ticket.js';
import { orderCreatedPublisher } from '../../src/event-bus/order-created-publisher.js';

const _route = '/api/orders';

testInfra();

async function createTicket() {
    return TicketModel.create({
        title: faker.music.artist(),
        price: { amount: mongoose.Types.Decimal128.fromString('10.00'), currency: 'EUR' },
        version: 1,
    });
}

describe('POST /api/orders', () => {
    it('returns 401 when not authenticated', async () => {
        await request(app.server)
            .post(_route)
            .send({ ticketId: 'a'.repeat(24) })
            .expect(401);
    });

    it.each(['', 'abc', 'z'.repeat(24), 'a'.repeat(25)])(
        'returns 400 for invalid ticketId "%s"',
        async (ticketId) => {
            await request(app.server)
                .post(_route)
                .set('Cookie', createJwtCookie())
                .send({ ticketId })
                .expect(400);
        }
    );

    it('returns 404 when the ticket does not exist', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ ticketId: nonExistentId })
            .expect(404);
    });

    it.each([OrderStatus.Created, OrderStatus.AwaitingPayment, OrderStatus.Complete])(
        'returns 400 when ticket is already reserved (has a "%s" status)',
        async (status) => {
            const ticket = await createTicket();
            await OrderModel.create({
                userId: 'someOtherUser',
                status,
                ticket: ticket._id,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });

            await request(app.server)
                .post(_route)
                .set('Cookie', createJwtCookie())
                .send({ ticketId: ticket._id.toString() })
                .expect(400);
        }
    );

    it('allows ordering a ticket who only has cancelled orders', async () => {
        const ticket = await createTicket();
        await OrderModel.create({
            userId: 'someOtherUser',
            status: OrderStatus.Cancelled,
            ticket: ticket._id,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });

        await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ ticketId: ticket._id.toString() })
            .expect(201);
    });

    it('creates an order and returns 201', async () => {
        const userId = 'JohnDoe';
        const ticket = await createTicket();
        const ordersBefore = await OrderModel.countDocuments();
        const before = Date.now();

        const response = await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie(userId))
            .send({ ticketId: ticket._id.toString() })
            .expect(201);

        expect(await OrderModel.countDocuments()).toBe(ordersBefore + 1);
        expect(response.body.userId).toBe(userId);
        expect(response.body.status).toBe(OrderStatus.Created);
        expect(response.body.ticket.id).toBe(ticket._id.toString());
        const expiresAt = new Date(response.body.expiresAt).getTime();
        expect(expiresAt).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);

        expect(orderCreatedPublisher.publish).toHaveBeenCalledOnce();
        expect(orderCreatedPublisher.publish).toHaveBeenCalledWith({
            id: response.body.id,
            userId,
            status: OrderStatus.Created,
            ticket: {
                id: ticket._id.toString(),
                price: { amount: '10.00', currency: 'EUR' },
            },
            expiresAt: expect.any(String),
            version: 1,
        });
    });
});
