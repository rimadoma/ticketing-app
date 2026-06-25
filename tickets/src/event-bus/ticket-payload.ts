import type { DocumentType } from '@typegoose/typegoose';
import type { TicketCreatedEvent } from '@mahonen_consulting_zlc/common';
import type { Ticket } from '../models/ticket.js';

export function toTicketPayload(ticket: DocumentType<Ticket>): TicketCreatedEvent['data'] {
    return {
        _id: ticket.id,
        title: ticket.title,
        price: {
            amount: ticket.price.amount.toString(),
            currency: ticket.price.currency,
        },
        userId: ticket.userId,
    };
}
