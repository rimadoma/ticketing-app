import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createUser, testInfra } from './test-utils.js'

testInfra();

describe('GET /api/users/currentuser', () => {
    it('returns 200 and shows details for a valid current user', async() => {
        const credentials = { email: 'test@test.com', password: 'password' };
        const cookie = await createUser(credentials);

        const response = await request(app.server)
            .get('/api/users/currentuser')
            .set("Cookie", cookie)
            .send()
            .expect(200);

        const currentUser = response.body.currentUser;
        expect(currentUser.email).toEqual(credentials.email);
        expect(currentUser.id).toBeDefined();
        expect(currentUser.iat).toBeDefined();
        expect(currentUser.exp).toBeDefined();
    });

    it('returns 401 when not signed in', async () => {
        await request(app.server)
            .get('/api/users/currentuser')
            .expect(401);
    });
});