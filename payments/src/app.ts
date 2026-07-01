import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError, currentUserPlugin, requireAuthPlugin } from '@mahonen_consulting_zlc/common';
import fastifyCookie from '@fastify/cookie';
import { createRoute } from './routes/create.js';

export async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify({ trustProxy: true });

    instance.register(fastifyCookie);

    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    instance.setSchemaErrorFormatter(schemaErrorFormatter);

    instance.setNotFoundHandler(() => { throw new NotFoundError(); });

    instance.setErrorHandler(errorHandler);

    instance.register(currentUserPlugin);

    instance.register(async (protectedScope: FastifyInstance) => {
        await requireAuthPlugin(protectedScope);
        protectedScope.register(createRoute);
    });

    return instance;
}
