import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, testInfra, createUser } from './test-utils.js'

testInfra();

describe('POST /api/users/signin', () => {
    it('returns 400 for a non-existing user', async () => {
        await request(app.server)
            .post('/api/users/signin')
            .send({ email: 'test@test.com', password: 'password' })
            .expect(400);
    });

    it('returns 200 and a cookie for a valid sign in', async () => {
        const credentials = { email: 'test@test.com', password: 'password' };
        await createUser(credentials);

        const response = await request(app.server)
            .post('/api/users/signin')
            .send(credentials)
            .expect(200);

        expect(response.get('Set-Cookie')).toBeDefined();
    });

    it('returns 400 for a bad password', async () => {
        const credentials = { email: 'test@test.com', password: 'password' };
        await createUser(credentials);

        await request(app.server)
            .post('/api/users/signin')
            .send( {email: credentials.email, password: 'someOtherPassword'} )
            .expect(400);
    });
});