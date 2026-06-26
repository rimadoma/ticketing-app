import type Event from './event.js';
import type { Routes } from '../routes.js';
import { orderSchema } from '../schemas/order.js';

export interface OrderCreatedEvent extends Event<typeof orderSchema> {
    route: Routes.ORDER_CREATED;
}
