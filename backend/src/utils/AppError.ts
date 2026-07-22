export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(401, 'UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(403, 'FORBIDDEN', msg);
  }
  static notFound(msg = 'Not found') {
    return new AppError(404, 'NOT_FOUND', msg);
  }
  static conflict(msg = 'Conflict') {
    return new AppError(409, 'CONFLICT', msg);
  }
  static tooMany(msg = 'Too many requests') {
    return new AppError(429, 'RATE_LIMITED', msg);
  }
  static internal(msg = 'Internal server error') {
    return new AppError(500, 'INTERNAL', msg);
  }
}
