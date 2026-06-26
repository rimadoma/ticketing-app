import type amqp from 'amqplib';
import mongoose from 'mongoose';
import { Listener, Routes, ticketSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { TicketCreatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
    protected readonly route = Routes.TICKET_CREATED;
    protected readonly schema = ticketSchema;

    protected async onMessage(data: TicketCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let existing;
        try {
            existing = await TicketModel.findById(data.id);
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_READ_ERROR);
        }
        if (existing) {
            console.warn(`Stale ticket.created event: ticket ${data.id} already exists at v${existing.version}`);
            return;
        }
        try {
            await TicketModel.create({
                _id: data.id,
                title: data.title,
                price: {
                    amount: mongoose.Types.Decimal128.fromString(data.price.amount),
                    currency: data.price.currency,
                },
                version: data.version,
            });
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
    }
}

export const ticketCreatedListener = new TicketCreatedListener();
