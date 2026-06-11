import jwt from 'jsonwebtoken';
import { AppError } from '@ticketing/common';

export class Jwt {
    static signToken(userId: string, email: string): string {
        try {
            return jwt.sign({ id: userId, email: email }, process.env.JWT_KEY!, { expiresIn: '15m' });
        } catch (err) {
            throw new AppError(err, 1236);
        }
    }
}
