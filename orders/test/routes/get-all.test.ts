import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createJwtCookie, createOrders, testInfra } from '../test-utils.js';

const _route = '/api/orders';

testInfra();

describe('GET /api/orders', () => {
    it('returns 401 when not authenticated', async () => {
        await request(app.server)
            .get(_route)
            .send()
            .expect(401);
    });

    it('returns an empty array when no orders exist', async () => {
        const response = await request(app.server)
            .get(_route)
            .set('Cookie', createJwtCookie())
            .send()
            .expect(200);

        expect(response.body).toEqual([]);
    });

    it('returns only orders belonging to the current user', async () => {
        const userId = 'JohnDoe';
        const otherUserId = 'JaneDoe';
        await createOrders(2, userId);
        await createOrders(3, otherUserId);

        const response = await request(app.server)
            .get(_route)
            .set('Cookie', createJwtCookie(userId))
            .send()
            .expect(200);

        const orders: { userId: string }[] = response.body;
        expect(orders.length).toBe(2);
        expect(orders.every(o => o.userId === userId)).toBe(true);
    });
});
