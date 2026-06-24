import { Routes } from './routes.js';
import type Event from './event.js';

export interface TicketCreatedEvent extends Event {
    route: Routes.TICKET_CREATED;
    data: {
        _id: string
        title: string;
        price: {
            amount: string
            currency: string
        },
        userId: string
    }
}