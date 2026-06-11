import type { FastifyInstance } from 'fastify';

export async function signoutRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post('/api/users/signout', async (_request, reply) => {
        return reply.clearCookie("token").code(200).send();
    });
}
