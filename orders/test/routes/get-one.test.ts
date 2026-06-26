import request from 'supertest';
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { app, createJwtCookie, createOrders, testInfra } from '../test-utils.js';

const route = (id: string) => `/api/orders/${id}`;

testInfra();

describe('GET /api/orders/:id', () => {
    it('returns 401 when not authenticated', async () => {
        await request(app.server)
            .get(route(new mongoose.Types.ObjectId().toString()))
            .send()
            .expect(401);
    });

    it.each(['abc', 'z'.repeat(24), 'a'.repeat(25)])(
        'returns 400 for invalid id "%s"',
        async (id) => {
            await request(app.server)
                .get(route(id))
                .set('Cookie', createJwtCookie())
                .send()
                .expect(400);
        }
    );

    it('returns 404 when order does not exist', async () => {
        await request(app.server)
            .get(route(new mongoose.Types.ObjectId().toString()))
            .set('Cookie', createJwtCookie())
            .send()
            .expect(404);
    });

    it('returns 404 when order belongs to a different user', async () => {
        const orders = await createOrders(1, 'JaneDoe');

        await request(app.server)
            .get(route(orders[0]!.id))
            .set('Cookie', createJwtCookie('JohnDoe'))
            .send()
            .expect(404);
    });

    it('returns 200 with the order and populated ticket', async () => {
        const userId = 'JohnDoe';
        const orders = await createOrders(1, userId);

        const response = await request(app.server)
            .get(route(orders[0]!.id))
            .set('Cookie', createJwtCookie(userId))
            .send()
            .expect(200);

        expect(response.body.id).toBe(orders[0]!.id);
        expect(response.body.userId).toBe(userId);
        expect(response.body.ticket.id).toBe(orders[0]!.ticket.id);
    });
});
