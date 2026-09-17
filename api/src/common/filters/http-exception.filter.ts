import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.normalizeException(exception);

    const body: ApiErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= 500) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          `${request.method} ${request.url} → ${statusCode}`,
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.error(`${request.method} ${request.url} → ${statusCode}`);
      }
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${statusCode}`);
    }

    response.status(statusCode).json(body);
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          statusCode,
          message: exceptionResponse,
          error: HttpStatus[statusCode] ?? 'Error',
        };
      }

      const responseObject = exceptionResponse as Record<string, unknown>;
      const message =
        (responseObject.message as string | string[]) ?? exception.message;
      const error =
        (responseObject.error as string) ?? HttpStatus[statusCode] ?? 'Error';

      return { statusCode, message, error };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
