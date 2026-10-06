import express from 'express';

// Express 4 ignores the promise returned by an async handler, so a rejected
// promise never reaches the error middleware — on Node 22 it becomes an
// unhandled rejection and terminates the process. Wrapping every route handler
// once, here, forwards those rejections to next(err) instead.
// (Express 5 does this natively; this keeps us on Express 4 without a new dependency.)

const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

function wrap(handler) {
  if (typeof handler !== 'function' || handler.length === 4) return handler; // error middleware untouched
  return function asyncSafeHandler(req, res, next) {
    try {
      const result = handler.call(this, req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
      return result;
    } catch (err) {
      return next(err);
    }
  };
}

function wrapArgs(args) {
  return args.map((arg) => (Array.isArray(arg) ? wrapArgs(arg) : wrap(arg)));
}

for (const method of ROUTE_METHODS) {
  const original = express.Route.prototype[method];
  if (typeof original !== 'function') continue;
  express.Route.prototype[method] = function patchedRouteMethod(...handlers) {
    return original.apply(this, wrapArgs(handlers));
  };
}

// Final error handler: never leak stack traces or SQL to the client.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON request body.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Something went wrong on our side. Please try again.' : err.message
  });
}
