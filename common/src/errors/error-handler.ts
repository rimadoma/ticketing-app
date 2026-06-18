import type { FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';
import { AppError, BadRequestError, CustomError, RequestValidationError } from './custom-error.js';

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
