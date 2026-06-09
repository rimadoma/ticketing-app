import type { FastifyInstance } from 'fastify';
import { type UserCredentials, userCredentialsSchema } from './user-credentials.js';

export async function signupRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: UserCredentials }>('/api/users/signup', { schema: userCredentialsSchema },
        async (request, reply) => {
            const { email, password } = request.body;
            return reply.code(201).send();
        });
}
