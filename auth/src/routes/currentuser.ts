import type { FastifyInstance } from 'fastify';

export async function currentUserRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/users/currentuser', async (_request, reply) => {
        return reply.code(200).send("Hello");
    });
}
