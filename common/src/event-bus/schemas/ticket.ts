import { z } from 'zod';

export const ticketSchema = z.object({
    id: z.hex().length(24),
    title: z.string().min(1),
    price: z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        currency: z.string().length(3),
    }),
    userId: z.string().min(1),
    version: z.int32().min(1)
});
