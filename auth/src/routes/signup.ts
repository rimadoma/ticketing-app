import type { FastifyInstance } from 'fastify';
import { type UserCredentials, userCredentialsSchema } from './user-credentials.js';
import { UserModel } from '../models/user.js';
import { AppError, BadRequestError } from '@ticketing/common';

export async function signupRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: UserCredentials }>('/api/users/signup', { schema: userCredentialsSchema },
        async (request, reply) => {
            const { email, password } = request.body;

            if (await isExistingUser(email)) {
                throw new BadRequestError('Email already registered');
            }

            await createNewUser(email, password);

            // TODO: send back JWT/cookie/something...
            return reply.code(201).send("Verification email sent");
        });
}

async function isExistingUser(email: string): Promise<boolean> {
    return await UserModel.findOne({ email: email }) !== null;
}

async function createNewUser(email: string, password: string): Promise<void> {
    try {
        await UserModel.create({ email, password });
    } catch (err) {
        throw new AppError(err, 1235);
    }
}