import type { FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';

type FieldError = { message: string; field?: string };

type SerializedError = { statusCode: number; errors: FieldError[]; errorId?: number };

export abstract class CustomError extends Error {
    abstract statusCode: number;
    abstract serializeErrors(): SerializedError;
}

export class RequestValidationError extends CustomError {
    statusCode = 400;

    constructor(public fieldErrors: FieldError[]) {
        super('Validation error');
    }

    serializeErrors(): SerializedError {
        return { statusCode: this.statusCode, errors: this.fieldErrors };
    }
}

export class AppError extends CustomError {
    statusCode = 500;

    constructor(public errorId: number) {
        super('Something went wrong');
    }

    serializeErrors(): SerializedError {
        return { statusCode: this.statusCode, errorId: this.errorId, errors: [{ message: 'Something went wrong' }] };
    }
}

export class NotFoundError extends CustomError {
    statusCode = 404;

    constructor() {
        super('Not found');
    }

    serializeErrors(): SerializedError {
        return { statusCode: this.statusCode, errors: [{ message: 'Not found' }] };
    }
}

export function schemaErrorFormatter(errors: FastifySchemaValidationError[], _dataVar: string): RequestValidationError {
    const fieldErrors = errors.filter(e => e.instancePath).map(e => {
        const field = e.instancePath.replace(/^\//, '');
        return { field, message: e.message ?? 'Invalid value' };
    });
    return new RequestValidationError(fieldErrors.length > 0 ? fieldErrors : [{ message: 'Invalid request' }]);
}

export function errorHandler(error: CustomError, _request: FastifyRequest, reply: FastifyReply): object {
    return reply.code(error.statusCode).send(error.serializeErrors());
}
