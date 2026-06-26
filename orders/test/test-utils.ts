import { beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { createApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify/types/instance.js';
import jwt from 'jsonwebtoken';
import { OrderModel } from '../src/models/order.js';
import { TicketModel } from '../src/models/ticket.js';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { orderCreatedPublisher } from '../src/event-bus/order-created-publisher.js';
import { orderCancelledPublisher } from '../src/event-bus/order-cancelled-publisher.js';

export let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export interface CreatedTicket {
    id: string;
    title: string;
    price: { amount: string; currency: string };
    version: number;
}

export async function createOrders(n: number, userId?: string): Promise<{ id: string; ticket: CreatedTicket }[]> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const results: { id: string; ticket: CreatedTicket }[] = [];

    for (let i = 0; i < n; i++) {
        const ticket = await TicketModel.create({
            title: faker.commerce.productName(),
            price: { amount: mongoose.Types.Decimal128.fromString('10.00'), currency: 'EUR' },
            version: 1,
        });
        const order = await OrderModel.create({
            userId: userId ?? 'JohnDoe',
            status: OrderStatus.Created,
            ticket: ticket._id,
            expiresAt,
            version: 1,
        });
        results.push({
            id: order._id.toString(),
            ticket: {
                id: ticket._id.toString(),
                title: ticket.title,
                price: { amount: ticket.price.amount.toString(), currency: ticket.price.currency },
                version: ticket.version,
            },
        });
    }

    return results;
}

export function createJwtCookie(userId = 'JohnDoe'): string[] {
    const payload = { id: userId, email: faker.internet.email() };
    const token = jwt.sign(payload, process.env.JWT_KEY!);
    return [`token=${token}; Path=/; Secure; HttpOnly;`];
}

export function testInfra() {
    beforeAll(async () => {
        vi.spyOn(orderCreatedPublisher, 'publish').mockResolvedValue(undefined);
        vi.spyOn(orderCancelledPublisher, 'publish').mockResolvedValue(undefined);

        mongo = await MongoMemoryServer.create();
        const mongoUri = mongo.getUri();

        await mongoose.connect(mongoUri, {});

        process.env.JWT_KEY = 'test-secret';
        app = await createApp();
        await app.ready();
    });

    beforeEach(async () => {
        vi.clearAllMocks();

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
