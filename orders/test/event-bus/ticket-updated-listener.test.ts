import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { ticketUpdatedListener } from '../../src/event-bus/ticket-updated-listener.js';
import { TicketModel } from '../../src/models/ticket.js';
import { dbInfra } from '../test-utils.js';

dbInfra();

function onMessage(data: object) {
    return (ticketUpdatedListener as any).onMessage(data, {} as amqp.ConsumeMessage);
}

async function seedTicket(id: string, version: number) {
    return TicketModel.create({
        _id: id,
        title: 'Original Title',
        price: { amount: mongoose.Types.Decimal128.fromString('10.00'), currency: 'EUR' },
        version,
    });
}

describe('TicketUpdatedListener', () => {
    it('updates title, price, and version when the event is newer', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await seedTicket(id, 1);

        await onMessage({
            id,
            title: 'Updated Title',
            price: { amount: '99.99', currency: 'USD' },
            userId: 'user-abc',
            version: 2,
        });

        const ticket = await TicketModel.findById(id);
        expect(ticket!.title).toBe('Updated Title');
        expect(ticket!.price.amount.toString()).toBe('99.99');
        expect(ticket!.price.currency).toBe('USD');
        expect(ticket!.version).toBe(2);
    });

    it('ignores the event when the ticket does not exist', async () => {
        const id = new mongoose.Types.ObjectId().toHexString();

        await onMessage({
            id,
            title: 'Ghost Ticket',
            price: { amount: '10.00', currency: 'EUR' },
            userId: 'user-abc',
            version: 2,
        });

        expect(await TicketModel.countDocuments({ _id: id })).toBe(0);
    });

    it.each([
        { label: 'same version', currentVersion: 3, eventVersion: 3 },
        { label: 'older version', currentVersion: 3, eventVersion: 2 },
    ])('ignores a stale event ($label: current v$currentVersion, event v$eventVersion)', async ({ currentVersion, eventVersion }) => {
        const id = new mongoose.Types.ObjectId().toHexString();
        await seedTicket(id, currentVersion);

        await onMessage({
            id,
            title: 'Should Not Apply',
            price: { amount: '1.00', currency: 'EUR' },
            userId: 'user-abc',
            version: eventVersion,
        });

        const ticket = await TicketModel.findById(id);
        expect(ticket!.title).toBe('Original Title');
        expect(ticket!.version).toBe(currentVersion);
    });
});
