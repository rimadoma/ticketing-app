import type { FastifyInstance } from 'fastify';

export async function signoutRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post('/api/users/signout', async (_request, reply) => {
        return reply.clearCookie("token", { httpOnly: true, sameSite: 'strict', path: '/' }).code(200).send();
    });
}
