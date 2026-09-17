import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../middleware/request-id.middleware';

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const { statusCode, message, error, code } =
      this.normalizeException(exception);

    const body: ApiErrorResponse = {
      statusCode,
      code,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
    };

    const logPayload = {
      timestamp: body.timestamp,
      level: statusCode >= 500 ? 'error' : 'warn',
      requestId: request.requestId,
      method: request.method,
      path: request.url,
      statusCode,
      code,
    };

    if (statusCode >= 500) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          JSON.stringify(logPayload),
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.error(JSON.stringify(logPayload));
      }
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    response.status(statusCode).json(body);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
    code: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode,
          message: exceptionResponse,
          error: HttpStatus[statusCode] ?? 'Error',
          code: this.codeFromStatus(statusCode),
        };
      }

      const responseObject = exceptionResponse as Record<string, unknown>;
      const message =
        (responseObject.message as string | string[]) ?? exception.message;
      const error =
        (responseObject.error as string) ?? HttpStatus[statusCode] ?? 'Error';
      const code =
        typeof responseObject.code === 'string'
          ? responseObject.code
          : this.codeFromStatus(statusCode);

      return { statusCode, message, error, code };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    };
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMITED';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
