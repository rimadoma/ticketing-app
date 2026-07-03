import { describe, it, expect } from 'vitest';
import {
    AppError,
    BadRequestError,
    NotFoundError,
    RequestValidationError,
    UnauthorizedError,
} from '../../src/errors/custom-error.js';

describe('AppError', () => {
    it('keeps the underlying reason on .message for logging', () => {
        const appError = new AppError(new Error('mongo connection refused'), 1234);
        expect(appError.message).toBe('mongo connection refused');
    });

    it('stringifies a non-Error cause for .message', () => {
        const appError = new AppError('raw failure', 1234);
        expect(appError.message).toBe('raw failure');
    });

    it('hides the internal reason when serialized, exposing only errorId and a generic message', () => {
        const appError = new AppError(new Error('mongo connection refused'), 1234);
        expect(appError.serializeErrors()).toEqual({
            statusCode: 500,
            errorId: 1234,
            errors: [{ message: 'Something went wrong' }],
        });
    });
});

describe('RequestValidationError', () => {
    it('serializes its field errors verbatim', () => {
        const fieldErrors = [{ field: 'email', message: 'must be a valid email' }];
        const err = new RequestValidationError(fieldErrors);
        expect(err.serializeErrors()).toEqual({ statusCode: 400, errors: fieldErrors });
    });
});

describe('CustomError subclasses', () => {
    it('carry the expected status codes and serialize their message', () => {
        expect(new BadRequestError('bad').statusCode).toBe(400);
        expect(new NotFoundError().serializeErrors()).toEqual({ statusCode: 404, errors: [{ message: 'Not found' }] });
        expect(new UnauthorizedError().serializeErrors()).toEqual({ statusCode: 401, errors: [{ message: 'Unauthorized' }] });
    });
});
