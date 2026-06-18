import { z } from 'zod';

export const ticketBodySchema = {
    body: z.object({
        title: z.string().min(1),
        price: z.string().min(1),
    }),
};

export type TicketBody = z.infer<typeof ticketBodySchema.body>;

export const ticketParamsSchema = {
    params: z.object({
        id: z.string().min(1),
    }),
};

export type TicketParams = z.infer<typeof ticketParamsSchema.params>;
