import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { RequestWithId } from '../middleware/request-id.middleware';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      RequestWithId & { user?: AuthenticatedUser }
    >();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = http.getResponse<Response>();
          this.emit(request, response.statusCode, Date.now() - startedAt);
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof Object &&
            'status' in error &&
            typeof (error as { status: unknown }).status === 'number'
              ? (error as { status: number }).status
              : 500;
          this.emit(request, statusCode, Date.now() - startedAt);
        },
      }),
    );
  }

  private emit(
    request: RequestWithId & { user?: AuthenticatedUser },
    statusCode: number,
    durationMs: number,
  ): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'error' : 'info',
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode,
      durationMs,
      userId: request.user?.id,
    };
    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(payload));
    } else {
      this.logger.log(JSON.stringify(payload));
    }
  }
}
