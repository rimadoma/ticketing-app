import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createTickets, testInfra } from '../test-utils.js';

const _route = '/api/tickets';

testInfra();

describe('GET /api/tickets/:id', () => {
    it.each([
        'not-a-valid-id',
        '0',
        '0000000000000000000000000',
    ])('returns 400 for malformed id "%s"', async (id) => {
        await request(app.server)
            .get(`${_route}/${id}`)
            .send()
            .expect(400);
    });

    it('returns 404 if the ticket does not exist', async () => {
        await request(app.server)
            .get(`${_route}/000000000000000000000000`)
            .send()
            .expect(404);
    });

    it('returns the correct ticket', async () => {
        const tickets = await createTickets(['Mähönen ZLC launch party', 'Another Event', 'Third Event']);
        const { id } = tickets.find(t => t.title === 'Mähönen ZLC launch party')!;

        const response = await request(app.server)
            .get(`${_route}/${id}`)
            .send()
            .expect(200);

        expect(response.body.id).toBe(id);
        expect(response.body.title).toBe('Mähönen ZLC launch party');
    });
});
