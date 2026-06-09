import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError } from '@ticketing/common';
import { currentUserRoutes } from './routes/currentuser.js';
import { signupRoutes } from './routes/signup.js';
import { signinRoutes } from './routes/signin.js';
import { signoutRoutes } from './routes/signout.js';

const _port = 3000;

async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify();
    
    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    instance.setSchemaErrorFormatter(schemaErrorFormatter);
    
    instance.setNotFoundHandler(() => { throw new NotFoundError(); });

    instance.setErrorHandler(errorHandler);

    instance.register(currentUserRoutes);
    instance.register(signupRoutes);
    instance.register(signinRoutes);
    instance.register(signoutRoutes);
    
    await instance.listen({ port: _port, host: "0.0.0.0" });
    
    return instance;
}

await createApp();
console.log(`Listening on ${_port}`)