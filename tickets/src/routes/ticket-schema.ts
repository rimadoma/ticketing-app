import { z } from 'zod';

export const ticketBodySchema = {
    body: z.object({
        title: z.string().min(1),
        price: z.object({
            amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
            currency: z.string().length(3).default('EUR'),
        }),
    }),
};

export type TicketBody = z.infer<typeof ticketBodySchema.body>;

export const ticketParamsSchema = {
    params: z.object({
        id: z.hex().length(24),
    }),
};

export type TicketParams = z.infer<typeof ticketParamsSchema.params>;
