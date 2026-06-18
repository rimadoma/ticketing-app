export type FieldError = { message: string; field?: string };

export type SerializedError = { statusCode: number; errors: FieldError[]; errorId?: number };

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
