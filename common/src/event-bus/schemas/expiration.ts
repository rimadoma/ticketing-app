import { z } from 'zod';

export const expirationSchema = z.object({
    orderId: z.hex().length(24),
    version: z.int32().min(1),
});
