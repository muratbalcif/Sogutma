import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';
import { RedisThrottlerStorage } from './redis-throttler.storage';

export { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
      ): Redis => {
        const url = config.get('REDIS_URL', { infer: true });
        const isTest = config.get('NODE_ENV', { infer: true }) === 'test';
        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: isTest ? 500 : 5_000,
          enableOfflineQueue: false,
          retryStrategy: (times) => {
            if (isTest) {
              return null;
            }
            return Math.min(times * 200, 2000);
          },
        });
        client.on('error', () => undefined);
        void client.connect().catch(() => undefined);
        return client;
      },
    },
    RedisThrottlerStorage,
  ],
  exports: [REDIS_CLIENT, RedisThrottlerStorage],
})
export class RedisModule {}
