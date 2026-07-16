/** Small HTTP helpers: typed API errors + async route wrapper. */

export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, 'bad_request', msg, details); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, 'unauthorized', msg); }
  static forbidden(msg = 'Forbidden') { return new ApiError(403, 'forbidden', msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, 'not_found', msg); }
  static conflict(msg, details) { return new ApiError(409, 'conflict', msg, details); }
}

/** Wrap an async express handler so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
