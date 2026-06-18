import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, createUser, testInfra } from './test-utils.js'

testInfra();

describe('POST /api/users/signout', () => {
    it('clears cookie and sends 200 for a successful sign out', async () => {
        const credentials = { email: 'test@test.com', password: 'password' };
        await createUser(credentials);

        const response = await request(app.server)
            .post('/api/users/signout')
            .send()
            .expect(200);

        const cookie = response.get("Set-Cookie");
        expect(cookie).toBeDefined();
        expect(cookie![0]).toContain("token=;");
    });
});