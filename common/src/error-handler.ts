import type { FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';

type FieldError = { message: string; field?: string };

type SerializedError = { statusCode: number; errors: FieldError[]; errorId?: number };

export abstract class CustomError extends Error {
    abstract statusCode: number;

    serializeErrors(): SerializedError {
        return { statusCode: this.statusCode, errors: [{ message: this.message }] };
    }
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

    constructor(err: unknown, public errorId: number) {
        const reason = err instanceof Error ? err.message : String(err);
        super(reason);
    }

    serializeErrors(): SerializedError {
        return { statusCode: this.statusCode, errorId: this.errorId, errors: [{ message: 'Something went wrong' }] };
    }
}

export class BadRequestError extends CustomError {
    statusCode = 400;

    constructor(public message: string) {
        super(message);
    }
}

export class NotFoundError extends CustomError {
    statusCode = 404;

    constructor() {
        super('Not found');
    }
}

export class UnauthorizedError extends CustomError {
    statusCode = 401;

    constructor() {
        super('Unauthorized');
    }
}

export function schemaErrorFormatter(errors: FastifySchemaValidationError[], _dataVar: string): RequestValidationError {
    const fieldErrors = errors.filter(e => e.instancePath).map(e => {
        const field = e.instancePath.replace(/^\//, '');
        return { field, message: e.message ?? 'Invalid value' };
    });
    return new RequestValidationError(fieldErrors.length > 0 ? fieldErrors : [{ message: 'Invalid request' }]);
}

export function errorHandler(error: Error, _request: FastifyRequest, reply: FastifyReply): void {
    let customError: CustomError;

    if (!(error instanceof CustomError)) {
        customError = new AppError(error, 9999);
    } else {
        customError = error;
    }
        
    if (error instanceof AppError || error instanceof BadRequestError) {
        console.error(error.message);
    }

    void reply.code(customError.statusCode).send(customError.serializeErrors());
}
