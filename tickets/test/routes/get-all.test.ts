import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createTickets, testInfra } from '../test-utils.js';

const _route = '/api/tickets';

testInfra();

describe('GET /api/tickets', () => {
    it('returns an empty array when no tickets exist', async () => {
        const response = await request(app.server)
            .get(_route)
            .send()
            .expect(200);

        expect(response.body).toEqual([]);
    });

    it('returns tickets', async () => {
        await createTickets(3);

        const response = await request(app.server)
            .get(_route)
            .send()
            .expect(200);

        const tickets: object[] = response.body;
        expect(tickets.length).toBe(3);
    });
});