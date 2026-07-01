import type Event from './event.js';
import type { Routes } from '../routes.js';
import { paymentSchema } from '../schemas/payment.js';

export interface PaymentCreatedEvent extends Event<typeof paymentSchema> {
    route: Routes.PAYMENT_CREATED;
}
