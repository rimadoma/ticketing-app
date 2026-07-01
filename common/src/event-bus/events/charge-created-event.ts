import type Event from './event.js';
import type { Routes } from '../routes.js';
import { chargeSchema } from '../schemas/charge.js';

export interface ChargeCreatedEvent extends Event<typeof chargeSchema> {
    route: Routes.CHARGE_CREATED;
}
