import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError, currentUserPlugin, requireAuthPlugin } from '@ticketing/common';
import { currentUserRoutes } from './routes/currentuser.js';
import { signupRoutes } from './routes/signup.js';
import { signinRoutes } from './routes/signin.js';
import { signoutRoutes } from './routes/signout.js';
import fastifyCookie from '@fastify/cookie';

export async function createApp(): Promise<FastifyInstance> {
    // True needed so that we're OK with https terminating at ingress
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
        protectedScope.register(currentUserRoutes);
    });
    instance.register(signupRoutes);
    instance.register(signinRoutes);
    instance.register(signoutRoutes);

    return instance;
}