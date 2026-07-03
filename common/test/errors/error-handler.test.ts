import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyReply, FastifyRequest, FastifySchemaValidationError } from 'fastify';
import { errorHandler, schemaErrorFormatter } from '../../src/errors/error-handler.js';
import { NotFoundError, RequestValidationError } from '../../src/errors/custom-error.js';

function buildReply() {
    const reply = {
        code: vi.fn(() => reply),
        send: vi.fn(() => reply),
    };
    return reply as unknown as FastifyReply & { code: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
}

const request = {} as FastifyRequest;

describe('errorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('serializes a CustomError with its own status code and payload', () => {
        const reply = buildReply();

        errorHandler(new NotFoundError(), request, reply);

        expect(reply.code).toHaveBeenCalledWith(404);
        expect(reply.send).toHaveBeenCalledWith({ statusCode: 404, errors: [{ message: 'Not found' }] });
    });

    it('wraps a Fastify body-parse 400 error as a BadRequestError', () => {
        const reply = buildReply();
        const parseError = Object.assign(new Error('Unexpected token } in JSON'), { statusCode: 400 });

        errorHandler(parseError, request, reply);

        expect(reply.code).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith({ statusCode: 400, errors: [{ message: 'Unexpected token } in JSON' }] });
    });

    it('wraps an unexpected error as a 500 AppError that hides the internal message', () => {
        const reply = buildReply();

        errorHandler(new Error('connection string leaked'), request, reply);

        expect(reply.code).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith({ statusCode: 500, errorId: 9999, errors: [{ message: 'Something went wrong' }] });
    });
});

describe('schemaErrorFormatter', () => {
    it('maps validation errors to field errors, stripping the leading slash from the path', () => {
        const errors = [
            { instancePath: '/email', message: 'must be a valid email' },
            { instancePath: '/password', message: 'too short' },
        ] as FastifySchemaValidationError[];

        const result = schemaErrorFormatter(errors, 'body');

        expect(result).toBeInstanceOf(RequestValidationError);
        expect(result.fieldErrors).toEqual([
            { field: 'email', message: 'must be a valid email' },
            { field: 'password', message: 'too short' },
        ]);
    });

    it('falls back to a generic message when no error has an instancePath', () => {
        const errors = [{ instancePath: '', message: 'nope' }] as FastifySchemaValidationError[];

        const result = schemaErrorFormatter(errors, 'body');

        expect(result.fieldErrors).toEqual([{ message: 'Invalid request' }]);
    });
});
