import type Event from './event.js';
import type { Routes } from '../routes.js';
import { ticketSchema } from '../schemas/ticket.js';

export interface TicketUpdatedEvent extends Event<typeof ticketSchema> {
    route: Routes.TICKET_UPDATED;
}
