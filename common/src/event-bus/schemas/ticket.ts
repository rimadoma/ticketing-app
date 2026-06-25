import { z } from 'zod';

export const ticketSchema = z.object({
    _id: z.string(),
    title: z.string(),
    price: z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        currency: z.string().length(3),
    }),
    userId: z.string().min(1),
});
