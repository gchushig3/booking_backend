import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

export function correlationIdMiddleware(
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-correlation-id');
  const correlationId =
    typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();

  req.correlationId = correlationId;
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}
