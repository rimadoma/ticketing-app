import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError, currentUserPlugin, requireAuthPlugin } from '@mahonen_consulting_zlc/common';
import fastifyCookie from '@fastify/cookie';
import { getAllTicketsRoute } from './routes/get-all.js';
import { getOneTicketRoute } from './routes/get-one.js';
import { createTicketRoute } from './routes/create.js';
import { updateTicketRoute } from './routes/update.js';

export async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify({ trustProxy: true });

    instance.register(fastifyCookie);

    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    instance.setSchemaErrorFormatter(schemaErrorFormatter);

    instance.setNotFoundHandler(() => { throw new NotFoundError(); });

    instance.setErrorHandler(errorHandler);

    instance.register(currentUserPlugin);

    instance.register(getAllTicketsRoute);
    instance.register(getOneTicketRoute);
    instance.register(async (protectedScope: FastifyInstance) => {
        await requireAuthPlugin(protectedScope);
        protectedScope.register(createTicketRoute);
        protectedScope.register(updateTicketRoute);
    });

    return instance;
}
