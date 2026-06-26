import { beforeAll, beforeEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { createApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify/types/instance.js';
import jwt from 'jsonwebtoken';
import { OrderModel, OrderStatus } from '../src/models/order.js';

export let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export async function createOrders(n: number, userId?: string): Promise<{ id: string; ticketId: string }[]> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const docs = await OrderModel.insertMany(
        Array.from({ length: n }, () => ({
            userId: userId ?? 'JohnDoe',
            status: OrderStatus.Pending,
            ticketId: new mongoose.Types.ObjectId().toString(),
            expiresAt,
        }))
    );

    return docs.map(d => ({ id: d._id.toString(), ticketId: d.ticketId }));
}

export function createJwtCookie(userId = 'JohnDoe'): string[] {
    const payload = { id: userId, email: faker.internet.email() };
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
