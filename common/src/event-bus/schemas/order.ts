import { z } from 'zod';
import { OrderStatus } from '../types/order-status.js';

export const orderSchema = z.object({
    id: z.hex().length(24),
    userId: z.hex().length(24),
    status: z.enum(OrderStatus),
    ticket: z.object({
        id: z.hex().length(24),
        price: z.object({
            amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
            currency: z.string().length(3),
        }),
    }),
    expiresAt: z.string().datetime(),
    version: z.int32().min(1),
});
