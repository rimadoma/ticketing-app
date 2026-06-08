import type { FastifyInstance } from 'fastify';
import { type UserCredentials, userCredentialsSchema } from './user-credentials.js';

export async function signinRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: UserCredentials }>('/api/users/signin', { schema: userCredentialsSchema }, async (request, reply) => {
        const { email, password } = request.body;
        return reply.code(200).send({});
    });
}
