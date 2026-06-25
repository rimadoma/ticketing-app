import { Publisher, Routes, type TicketCreatedEvent } from '@mahonen_consulting_zlc/common';

export class TicketCreatedPublisher extends Publisher<TicketCreatedEvent> {
    protected readonly route = Routes.TICKET_CREATED;
}

export const ticketCreatedPublisher = new TicketCreatedPublisher();
