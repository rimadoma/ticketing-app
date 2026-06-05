import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

const _port = 3000;

async function routes(fastify: FastifyInstance, _: any): Promise<void> {
    fastify.get('/api/users/currentuser', async (_request, reply) => {
        return reply.code(200).send("Hello");
    });
}

async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify();
    instance.register(routes);
    await instance.listen({ port: _port, host: "0.0.0.0" });
    return instance;
}

await createApp();
console.log(`Listening on ${_port}`)