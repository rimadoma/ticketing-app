import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { ticketCreatedListener } from '../../src/event-bus/ticket-created-listener.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (ticketCreatedListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

function buildData(overrides: object = {}) {
    return {
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'Concert Ticket',
        price: { amount: '49.99', currency: 'EUR' },
        userId: 'user-abc',
        version: 1,
        ...overrides,
    };
}

describe('TicketCreatedListener', () => {
    it('creates a ticket in the DB with all fields', async () => {
        const data = buildData();

        await onMessage(data);

        const ticket = await TicketModel.findById(data.id);
        expect(ticket).not.toBeNull();
        expect(ticket!.title).toBe(data.title);
        expect(ticket!.price.amount.toString()).toBe(data.price.amount);
        expect(ticket!.price.currency).toBe(data.price.currency);
        expect(ticket!.version).toBe(data.version);
    });

    it('is idempotent — ignores a duplicate event', async () => {
        const data = buildData();

        await onMessage(data);
        await onMessage(data);

        expect(await TicketModel.countDocuments({ _id: data.id })).toBe(1);
    });
});
