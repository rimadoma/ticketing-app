import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, setup } from './setup.js'

setup();

describe('POST /api/users/signup', () => {
    it('returns 201 on successful signup', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(201);
    });

    it('sets a cookie on successful signup', async () => {
        const response = await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(201);

        expect(response.get('Set-Cookie')).toBeDefined();
    });

    it('returns 400 when email is already in use', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(201);

        await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(400);
    });

    it('returns 400 with an invalid email', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'not-an-email', password: 'password' })
            .expect(400);
    });

    it('returns 400 with a password that is too short', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'abc' })
            .expect(400);
    });

    it('returns 400 when email or password is missing', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({})
            .expect(400);
    });
});