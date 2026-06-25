import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createJwtCookie, testInfra } from '../test-utils.js';
import { TicketModel } from '../../src/models/ticket.js';
import { ticketCreatedPublisher } from '../../src/event-bus/ticket-created-publisher.js';

const _route = '/api/tickets';

testInfra();

describe('POST /api/tickets', () => {
    it('has a route handler listening', async () => {
        const response = await request(app.server)
            .post(_route)
            .send({});

        expect(response.statusCode).not.toEqual(404);
    });

    it('can only be accessed if the user has signed in', async () => {
        const response = await request(app.server)
            .post(_route)
            .send({ title: 'Mähönen ZLC launch party', price: { amount: '36.99', currency: 'GBP' } });

        expect(response.statusCode).toEqual(401);
    });

    it('returns an error if title is invalid', async () => {
        const cookie = createJwtCookie();

        const response = await request(app.server)
            .post(_route)
            .set('Cookie', cookie)
            .send({ title: '', price: { amount: '36.99', currency: 'GBP' } });

        expect(response.statusCode).toEqual(400);
    });

    it.each(['0', '0.00', '99.9', '36.99'])('accepts valid amount "%s"', async (amount) => {
        const response = await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ title: 'Mähönen ZLC launch party', price: { amount, currency: 'GBP' } });

        expect(response.statusCode).toEqual(201);
    });

    it.each(['', 'abc', '-1', '1.999', '1.'])('returns 400 for invalid amount "%s"', async (amount) => {
        const response = await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ title: 'Mähönen ZLC launch party', price: { amount, currency: 'GBP' } });

        expect(response.statusCode).toEqual(400);
    });

    it.each(['', 'GB', 'GBPP'])('returns 400 for invalid currency "%s"', async (currency) => {
        const response = await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ title: 'Mähönen ZLC launch party', price: {  amount: '36.99', currency } });

        expect(response.statusCode).toEqual(400);
    });

    it('defaults currency to EUR when omitted', async () => {
        const response = await request(app.server)
            .post(_route)
            .set('Cookie', createJwtCookie())
            .send({ title: 'Mähönen ZLC launch party', price: { amount: '36.99' } })
            .expect(201);

        expect(response.body.price.currency).toBe('EUR');
    });

    it('creates a ticket when inputs are valid', async () => {
        const authenticatedUder = 'SomeBloke';
        const cookie = createJwtCookie(authenticatedUder);
        const ticketsBefore = await TicketModel.countDocuments();

        const response = await request(app.server)
            .post(_route)
            .set('Cookie', cookie)
            .send({ title: 'Mähönen ZLC launch party', price: { amount: '36.99', currency: 'GBP' } })
            .expect(201);

        const ticketsNow = await TicketModel.countDocuments();
        expect(ticketsNow).toBe(ticketsBefore + 1);
        const {userId, title,  price } = response.body;
        expect(userId).toBe(authenticatedUder);
        expect(title).toBe('Mähönen ZLC launch party');
        expect(price.amount).toBe('36.99');
        expect(price.currency).toBe('GBP');

        expect(ticketCreatedPublisher.publish).toHaveBeenCalledOnce();
        expect(ticketCreatedPublisher.publish).toHaveBeenCalledWith({
            _id: response.body.id,
            title: 'Mähönen ZLC launch party',
            price: { amount: '36.99', currency: 'GBP' },
            userId: authenticatedUder,
        });
    });
});