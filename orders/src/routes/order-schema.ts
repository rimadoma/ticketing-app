import { z } from 'zod';

export const orderParamsSchema = {
    params: z.object({
        id: z.hex().length(24),
    }),
};

export type OrderParams = z.infer<typeof orderParamsSchema.params>;

export const orderBodySchema = {
    body: z.object({
        ticketId: z.hex().length(24),
    }),
};

export type OrderBody = z.infer<typeof orderBodySchema.body>;
