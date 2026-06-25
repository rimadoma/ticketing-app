import { z } from 'zod';
import type { Routes } from '../routes.js';

export default interface Event<TSchema extends z.ZodType> {
    route: Routes;
    data: z.infer<TSchema>;
}
