import { beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { createApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify/types/instance.js';
import jwt from 'jsonwebtoken';
import { TicketModel } from '../src/models/ticket.js';
import { ticketCreatedPublisher } from '../src/event-bus/ticket-created-publisher.js';
import { ticketUpdatedPublisher } from '../src/event-bus/ticket-updated-publisher.js';

export let mongo: MongoMemoryServer;
export let app: FastifyInstance;

export async function createTickets(n: number, userId?: string): Promise<{ id: string; title: string }[]>;
export async function createTickets(titles: string[], userId?: string): Promise<{ id: string; title: string }[]>;
export async function createTickets(nOrTitles: number | string[], userId = 'JohnDoe'): Promise<{ id: string; title: string }[]> {
    const titles = Array.isArray(nOrTitles)
        ? nOrTitles
        : Array.from({ length: nOrTitles }, () => faker.commerce.productName());

    const docs = await TicketModel.insertMany(
        titles.map(title => ({
            title,
            price: {
                amount: mongoose.Types.Decimal128.fromString(faker.commerce.price({ min: 1, max: 999, dec: 2 })),
                currency: faker.finance.currencyCode(),
            },
            userId,
        }))
    );

    return docs.map(d => ({ id: d._id.toString(), title: d.title }));
}

export function createJwtCookie(userId = 'JohnDoe'): string[] {
    const payload = { id: userId, email: 'test@test.com' }

    // Create the JWT
    const token = jwt.sign(payload, process.env.JWT_KEY!);

    return [`token=${token}; Path=/; Secure; HttpOnly;`];
}

export function testInfra() {
    beforeAll(async () => {
        vi.spyOn(ticketCreatedPublisher, 'publish').mockResolvedValue(undefined);
        vi.spyOn(ticketUpdatedPublisher, 'publish').mockResolvedValue(undefined);

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
