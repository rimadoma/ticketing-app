import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { serializerCompiler, validatorCompiler } from '@fastify/type-provider-zod';
import { errorHandler, schemaErrorFormatter, NotFoundError, AppError } from '@ticketing/common';
import { currentUserRoutes } from './routes/currentuser.js';
import { signupRoutes } from './routes/signup.js';
import { signinRoutes } from './routes/signin.js';
import { signoutRoutes } from './routes/signout.js';
import mongoose from 'mongoose';
import fastifyCookie from '@fastify/cookie';

const _mongoURL = 'auth-mongo-service';
const _port = 3000;
const _mongoPort = 27017;
const _dbName = 'auth';

async function openDbConnection(): Promise<void> {
    try {
        await mongoose.connect(`mongodb://${_mongoURL}:${_mongoPort}/${_dbName}`);
    } catch (err) {
        throw new AppError(err, 1233);
    }
}

async function createApp(): Promise<FastifyInstance> {

    const instance = Fastify({ trustProxy: true });

    instance.register(fastifyCookie);

    instance.setValidatorCompiler(validatorCompiler);
    instance.setSerializerCompiler(serializerCompiler);
    instance.setSchemaErrorFormatter(schemaErrorFormatter);

    instance.setNotFoundHandler(() => { throw new NotFoundError(); });

    instance.setErrorHandler(errorHandler);

    instance.register(currentUserRoutes);
    instance.register(signupRoutes);
    instance.register(signinRoutes);
    instance.register(signoutRoutes);

    openDbConnection();

    await instance.listen({ port: _port, host: "0.0.0.0" });

    return instance;
}

if (!process.env.JWT_KEY) {
    throw new Error('JWT_KEY must be defined');
}

await createApp();
console.log(`Listening on ${_port}`)