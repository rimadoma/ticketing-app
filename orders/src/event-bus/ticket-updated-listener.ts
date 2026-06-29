import type amqp from 'amqplib';
import mongoose from 'mongoose';
import { Listener, Routes, ticketSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { TicketUpdatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class TicketUpdatedListener extends Listener<TicketUpdatedEvent> {
    protected readonly route = Routes.TICKET_UPDATED;
    protected readonly schema = ticketSchema;
    protected readonly serviceName = 'orders';

    protected async onMessage(data: TicketUpdatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let result;
        try {
            result = await TicketModel.findOneAndUpdate(
                { _id: data.id, version: { $lt: data.version } },
                { $set: {
                    title: data.title,
                    price: {
                        amount: mongoose.Types.Decimal128.fromString(data.price.amount),
                        currency: data.price.currency,
                    },
                    version: data.version,
                }},
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
        if (!result) {
            console.warn(`ticket.updated event for ticket ${data.id} v${data.version} — not found or stale, discarding`);
        }
    }
}

export const ticketUpdatedListener = new TicketUpdatedListener();
