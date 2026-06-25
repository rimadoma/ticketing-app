import { Publisher, Routes, type TicketUpdatedEvent } from '@mahonen_consulting_zlc/common';

export class TicketUpdatedPublisher extends Publisher<TicketUpdatedEvent> {
    protected readonly route = Routes.TICKET_UPDATED;
}

export const ticketUpdatedPublisher = new TicketUpdatedPublisher();
