import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError, currentUserPlugin } from '@mahonen_consulting_zlc/common';
import fastifyCookie from '@fastify/cookie';

export async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify({ trustProxy: true });

    instance.register(fastifyCookie);

    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    instance.setSchemaErrorFormatter(schemaErrorFormatter);

    instance.setNotFoundHandler(() => { throw new NotFoundError(); });

    instance.setErrorHandler(errorHandler);

    instance.register(currentUserPlugin);

    // TODO: register route plugins here

    return instance;
}
