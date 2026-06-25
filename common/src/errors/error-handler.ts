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

    if (error instanceof CustomError) {
        customError = error;
    } else if ((error as Error & { statusCode?: number }).statusCode === 400) {
        // Fastify body-parse errors (invalid JSON syntax, wrong content-type, etc.)
        customError = new BadRequestError(error.message);
    } else {
        customError = new AppError(error, 9999);
    }

    if (customError instanceof AppError || customError instanceof BadRequestError) {
        console.error(error.message);
    }

    void reply.code(customError.statusCode).send(customError.serializeErrors());
}
