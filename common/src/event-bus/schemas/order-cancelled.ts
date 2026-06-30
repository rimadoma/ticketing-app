import { z } from 'zod';
import { OrderStatus } from '../types/order-status.js';

export const orderCancelledSchema = z.object({
    id: z.hex().length(24),
    userId: z.hex().length(24),
    status: z.enum(OrderStatus),
    ticketId: z.hex().length(24),
    expiresAt: z.iso.datetime(),
    version: z.int32().min(1),
});
