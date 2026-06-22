import { beforeAll, beforeEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify/types/instance.js';
import jwt from 'jsonwebtoken';

export let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export function createJwtCookie(userId = 'JohnDoe'): string[] {
    const payload = { id: userId, email: 'test@test.com' }

    // Create the JWT
    const token = jwt.sign(payload, process.env.JWT_KEY!);

    return [`token=${token}; Path=/; Secure; HttpOnly;`];
}

export function testInfra() {
    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        const mongoUri = mongo.getUri();

        await mongoose.connect(mongoUri, {});

        process.env.JWT_KEY = 'test-secret';
        app = await createApp();
        await app.ready();
    });

    beforeEach(async () => {
        if (mongoose.connection.db) {
            const collections = await mongoose.connection.db.collections();
            for (const collection of collections) {
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
