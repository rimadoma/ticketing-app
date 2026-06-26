import type amqp from 'amqplib';
import mongoose from 'mongoose';
import { Listener, Routes, ticketSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { TicketUpdatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class TicketUpdatedListener extends Listener<TicketUpdatedEvent> {
    protected readonly route = Routes.TICKET_UPDATED;
    protected readonly schema = ticketSchema;

    protected async onMessage(data: TicketUpdatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let ticket;
        try {
            ticket = await TicketModel.findById(data.id);
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_READ_ERROR);
        }

        if (!ticket) {
            console.warn(`ticket.updated event for unknown ticket ${data.id} — discarding`);
            return;
        }
        if (data.version <= ticket.version) {
            console.warn(`Stale ticket.updated event: ticket ${data.id} is at v${ticket.version}, got v${data.version}`);
            return;
        }

        ticket.title = data.title;
        ticket.price.amount = mongoose.Types.Decimal128.fromString(data.price.amount);
        ticket.price.currency = data.price.currency;
        ticket.version = data.version;
        
        try {
            await ticket.save();
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
    }
}

export const ticketUpdatedListener = new TicketUpdatedListener();
