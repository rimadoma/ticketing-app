import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function currentUserRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/users/currentuser', async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.code(200).send({ currentUser: request.currentUser });
    });
}
