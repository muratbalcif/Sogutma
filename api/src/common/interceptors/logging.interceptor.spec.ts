import { Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import type { RequestWithId } from '../middleware/request-id.middleware';

describe('LoggingInterceptor', () => {
  it('emits the same requestId as the request', () => {
    const interceptor = new LoggingInterceptor();
    const logs: string[] = [];
    const spy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        logs.push(String(message));
      });

    const request = {
      requestId: 'req-abc-12345678',
      method: 'GET',
      originalUrl: '/api/v1/health/live',
    } as RequestWithId;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 200 }),
      }),
    };

    interceptor
      .intercept(context as never, { handle: () => of({ ok: true }) })
      .subscribe();

    spy.mockRestore();
    expect(logs.some((line) => line.includes('req-abc-12345678'))).toBe(true);
  });
});
