import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import '@fastify/cookie';
import { Jwt } from './jwt.js';

export interface UserPayload {
    id: string;
    email: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        currentUser: UserPayload | null;
    }
}

export const currentUserPlugin = fp(async (fastify: FastifyInstance) => {
    fastify.decorateRequest('currentUser', null);

    fastify.addHook('preHandler', async (request: FastifyRequest) => {
        const token = request.cookies['token'];
        if (!token) return;
        request.currentUser = Jwt.verifyToken(token);
    });
});
