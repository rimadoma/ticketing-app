import { beforeAll, beforeEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/app.js';

let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export function createJwtCookie(userId = 'JohnDoe'): string[] {
    const payload = { id: userId, email: 'john.doe@company.com' };
    const token = jwt.sign(payload, process.env.JWT_KEY!);
    return [`token=${token}; Path=/; Secure; HttpOnly;`];
}

export function dbInfra() {
    beforeAll(async () => {
        mongo = await MongoMemoryServer.create();
        await mongoose.connect(mongo.getUri());
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
        await mongo.stop();
    });
}

export function testInfra() {
    dbInfra();

    beforeAll(async () => {
        app = await createApp();
        await app.ready();
    });
}
