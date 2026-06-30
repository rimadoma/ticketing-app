import type Event from './event.js';
import type { Routes } from '../routes.js';
import { expirationSchema } from '../schemas/expiration.js';

export interface ExpirationCompleteEvent extends Event<typeof expirationSchema> {
    route: Routes.EXPIRATION_COMPLETE;
}
