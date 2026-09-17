import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { newRequestId } from '../utils/security.util';

export type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && /^[a-zA-Z0-9\-_]{8,64}$/.test(incoming)
        ? incoming
        : newRequestId();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
