import type { FastifyInstance } from 'fastify';
import { type UserCredentials, userCredentialsSchema } from './user-credentials.js';
import { UserModel } from '../models/user.js';
import { AppError, BadRequestError } from '@ticketing/common';
import jwt from 'jsonwebtoken';

export async function signupRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: UserCredentials }>('/api/users/signup', { schema: userCredentialsSchema },
        async (request, reply) => {
            const { email, password } = request.body;

            if (await isExistingUser(email)) {
                throw new BadRequestError('Email already registered');
            }

            const user = await createNewUser(email, password);

            const token = signToken(user.id, email);

            return reply.cookie("token", token, { httpOnly: true }).code(201).send(user);
        });
}

async function isExistingUser(email: string): Promise<boolean> {
    return await UserModel.findOne({ email: email }) !== null;
}

function signToken(userId: string, email: string): string {
    try {
        return jwt.sign({ id: userId, email: email }, process.env.JWT_KEY!, { expiresIn: '15m' });
    } catch (err) {
        throw new AppError(err, 1236);
    }
}

async function createNewUser(email: string, password: string) {
    try {
        return await UserModel.create({ email, password });
    } catch (err) {
        throw new AppError(err, 1235);
    }
}