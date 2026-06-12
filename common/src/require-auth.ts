import type { FastifyInstance, FastifyRequest } from 'fastify';
import { UnauthorizedError } from './error-handler.js';

export const requireAuthPlugin = async (fastify: FastifyInstance) => {
    fastify.addHook('preHandler', async (request: FastifyRequest) => {
        if (!request.currentUser) {
            throw new UnauthorizedError();
        }
    });
};
