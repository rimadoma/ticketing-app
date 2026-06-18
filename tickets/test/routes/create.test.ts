import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, testInfra } from '../test-utils.js';

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
            .send({ title: 'Mähönen ZLC launch party', price: { amount: '36.99', currency: 'GBP' }});

        expect(response.statusCode).toEqual(401);
    });

    it('returns an error if title is invalid', async () => {

    });

    it('returns an error if price is invalid', async () => {

    });

    it('creates a ticket when inputs are valid', async () => {

    });
});