import { beforeAll, beforeEach, afterAll, expect } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify/types/instance.js';

export let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export function testInfra() {
    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        const mongoUri = mongo.getUri();

        await mongoose.connect(mongoUri, {});

        process.env.JWT_KEY = 'test-secret';
        process.env.NODE_ENV = 'test';
        app = await createApp();
        await app.ready();
    });

    beforeEach(async () => {
        if (mongoose.connection.db) {
            const collections = await mongoose.connection.db.collections();
            for (let collection of collections) {
                await collection.deleteMany({});
            }
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
        if (mongo) {
            await mongo.stop();
        }
    });
}

export async function createUser(credentials: { email: string; password: string }): Promise<string[]> {
    const response = await request(app.server)
        .post('/api/users/signup')
        .send(credentials)
        .expect(201);
    const cookie = response.get('Set-Cookie');
    expect(cookie).toBeDefined();
    return cookie!;    
}

