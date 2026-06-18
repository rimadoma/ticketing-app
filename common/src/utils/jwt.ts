import jwt from 'jsonwebtoken';
import type { UserPayload } from '../middleware/current-user.js';
import { AppError } from '../errors/custom-error.js';

export class Jwt {
    static signToken(userId: string, email: string): string {
        try {
            return jwt.sign({ id: userId, email }, process.env.JWT_KEY!, { expiresIn: '15m' });
        } catch (err) {
            throw new AppError(err, 1236);
        }
    }

    static verifyToken(token: string): UserPayload | null {
        try {
            return jwt.verify(token, process.env.JWT_KEY!) as UserPayload;
        } catch {
            return null;
        }
    }
}
