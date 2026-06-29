import type amqp from 'amqplib';
import mongoose from 'mongoose';
import { Listener, Routes, ticketSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { TicketCreatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
    protected readonly route = Routes.TICKET_CREATED;
    protected readonly schema = ticketSchema;
    protected readonly serviceName = 'orders';

    protected async onMessage(data: TicketCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let result;
        try {
            result = await TicketModel.updateOne(
                { _id: data.id },
                { $setOnInsert: {
                    title: data.title,
                    price: {
                        amount: mongoose.Types.Decimal128.fromString(data.price.amount),
                        currency: data.price.currency,
                    },
                    version: data.version,
                }},
                { upsert: true },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
        if (result.upsertedCount === 0) {
            console.warn(`Stale ticket.created event: ticket ${data.id} already exists`);
        }
    }
}

export const ticketCreatedListener = new TicketCreatedListener();
