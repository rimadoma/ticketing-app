import { z } from 'zod';

export const userCredentialsSchema = {
    body: z.object({
        email: z.email(),
        password: z.string().min(4).max(20),
    }),
};

export type UserCredentials = z.infer<typeof userCredentialsSchema.body>;
