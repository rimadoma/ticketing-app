import type { FastifyInstance } from 'fastify';
import { type UserCredentials, userCredentialsSchema } from './user-credentials.js';
import { UserModel } from '../models/user.js';
import { AppError, BadRequestError, Jwt } from '@ticketing/common';
import bcrypt from 'bcrypt';

const badCredentialsError = new BadRequestError('Login failed! Check your email or password');

export async function signinRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: UserCredentials }>('/api/users/signin', { schema: userCredentialsSchema }, async (request, reply) => {
        const { email, password } = request.body;

        const dbUser = await queryUser(email);
        if (!dbUser) {
            // Run bcrypt against a dummy hash on the no-user path so response time doesn't reveal registration status
            const dummyHash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234'
            await bcrypt.compare(password, dummyHash);
            throw badCredentialsError;
        }

        if (!(await bcrypt.compare(password, dbUser.password))) {
            throw badCredentialsError;
        }

        const token = Jwt.signToken(dbUser.id, dbUser.email);

        return reply.cookie("token", token, { httpOnly: true, secure: 'auto', sameSite: 'strict', path: '/' }).code(200).send(dbUser);
    });
}

async function queryUser(email: string) {
    try {
        return await UserModel.findOne({ email: email });
    } catch (err) {
        throw new AppError(err, 1234);
    }
}
