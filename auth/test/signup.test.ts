import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, testInfra } from './test-utils.js';
import { UserModel } from '../src/models/user.js';

testInfra();

describe('POST /api/users/signup', () => {
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

    it('returns 400 when email is missing', async () => {
        await request(app.server)
            .post('/api/users/signup')
            .send({ password: 'validPassword' })
            .expect(400);
    });

    it('creates a user in the database when inputs are valid', async () => {
        const usersBefore = await UserModel.countDocuments();

        const response = await request(app.server)
            .post('/api/users/signup')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(201);

        const usersNow = await UserModel.countDocuments();
        expect(usersNow).toBe(usersBefore + 1);
        const { id, email } = response.body;
        expect(id).toBeDefined();
        expect(email).toBe('test@test.com');
    });
});