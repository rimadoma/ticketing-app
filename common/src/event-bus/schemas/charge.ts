import { z } from 'zod';

export const chargeSchema = z.object({
    id: z.hex().length(24),
    orderId: z.hex().length(24),
    userId: z.hex().length(24),
    version: z.int32().min(1),
});
