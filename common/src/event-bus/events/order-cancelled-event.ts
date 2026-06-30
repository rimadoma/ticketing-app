import type Event from './event.js';
import type { Routes } from '../routes.js';
import { orderCancelledSchema } from '../schemas/order-cancelled.js';

export interface OrderCancelledEvent extends Event<typeof orderCancelledSchema> {
    route: Routes.ORDER_CANCELLED;
}
