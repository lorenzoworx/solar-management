import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function hasCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next; // Express identifies error middleware by its four parameters.
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { message: error.message } });
  } else if (error instanceof ZodError) {
    response.status(400).json({ error: { message: error.issues[0]?.message ?? 'Invalid request.' } });
  } else if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed') {
    response.status(400).json({ error: { message: 'Request body must be valid JSON.' } });
  } else if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { message: 'Request body is too large.' } });
  } else {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : 'unknown';
    console.error('API request failed', { code });
    response.status(503).json({ error: { message: 'The service is temporarily unavailable. Please try again.' } });
  }
};
