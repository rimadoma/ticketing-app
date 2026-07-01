import { z } from 'zod';

export const paymentSchema = z.object({
    id: z.string().regex(/^pi_[a-zA-Z0-9]+$/),
    orderId: z.hex().length(24),
    version: z.int32().min(1),
    price: z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        currency: z.string().length(3),
    }),
});
