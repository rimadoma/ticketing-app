import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createJwtCookie, createTickets, testInfra } from '../test-utils.js';
import { ticketUpdatedPublisher } from '../../src/event-bus/ticket-updated-publisher.js';

const _route = '/api/tickets';

testInfra();

describe('PUT /api/tickets/:id', () => {
    it.each([
        'not-a-valid-id',
        '0',
        '0000000000000000000000000',
    ])('returns 400 for malformed id "%s"', async (id) => {
        const cookie = createJwtCookie();

        await request(app.server)
            .put(`${_route}/${id}`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency: 'GBP' } })
            .expect(400);
    });

    it('returns 404 for a valid id that does not exist', async () => {
        const cookie = createJwtCookie();

        await request(app.server)
            .put(`${_route}/000000000000000000000000`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency: 'GBP' } })
            .expect(404);
    });

    it('returns 400 if title is empty', async () => {
        const [ticket] = await createTickets(1, 'SomeBloke');
        const cookie = createJwtCookie('SomeBloke');

        await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .set('Cookie', cookie)
            .send({ title: '', price: { amount: '36.99', currency: 'GBP' } })
            .expect(400);
    });

    it.each(['', 'abc', '-1', '1.999', '1.'])('returns 400 for invalid amount "%s"', async (amount) => {
        const [ticket] = await createTickets(1, 'SomeBloke');
        const cookie = createJwtCookie('SomeBloke');

        await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount, currency: 'GBP' } })
            .expect(400);
    });

    it.each(['', 'GB', 'GBPP'])('returns 400 for invalid currency "%s"', async (currency) => {
        const [ticket] = await createTickets(1, 'SomeBloke');
        const cookie = createJwtCookie('SomeBloke');

        await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency } })
            .expect(400);
    });

    it('can only be accessed if the user has signed in', async () => {
        const [ticket] = await createTickets(1);

        const response = await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency: 'GBP' } });

        expect(response.statusCode).toEqual(401);
    });

    it('can only be updated if the current user matches ticket owner', async () => {
        const [ticket] = await createTickets(['Mähönen ZLC launch party'], 'SomeBloke');
        const cookie = createJwtCookie('SomeOtherBloke');

        const response = await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency: 'GBP' } });

        expect(response.statusCode).toEqual(403);
    });

    it('updates the ticket', async () => {
        const [ticket] = await createTickets(['Mähönen ZLC launch party'], 'SomeBloke');
        const cookie = createJwtCookie('SomeBloke');

        const response = await request(app.server)
            .put(`${_route}/${ticket!.id}`)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC pyjama party', price: { amount: '36.99', currency: 'GBP' } });

        expect(response.statusCode).toEqual(200);
        const { title } = response.body;
        expect(title).toBe('Mähönen ZLC pyjama party');

        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledOnce();
        expect(ticketUpdatedPublisher.publish).toHaveBeenCalledWith({
            id: ticket!.id,
            title: 'Mähönen ZLC pyjama party',
            price: { amount: '36.99', currency: 'GBP' },
            userId: 'SomeBloke',
            version: 2,
        });
    });
});