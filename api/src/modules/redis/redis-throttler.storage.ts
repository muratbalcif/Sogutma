import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Redis-backed throttler storage for multi-instance rate limiting.
 * Falls back to in-process counters if Redis commands fail.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly local = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    try {
      const hits = await this.redis.incr(redisKey);
      if (hits === 1) {
        await this.redis.pexpire(redisKey, ttl);
      }
      const pttl = await this.redis.pttl(redisKey);
      const timeToExpire = pttl > 0 ? pttl : ttl;
      const isBlocked = hits > limit;
      let timeToBlockExpire = 0;
      if (isBlocked && blockDuration > 0) {
        const blockKey = `${redisKey}:block`;
        const blockTtl = await this.redis.pttl(blockKey);
        if (blockTtl < 0) {
          await this.redis.set(blockKey, '1', 'PX', blockDuration);
          timeToBlockExpire = blockDuration;
        } else {
          timeToBlockExpire = blockTtl;
        }
      }
      return {
        totalHits: hits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (error) {
      this.logger.warn(
        `Redis throttle failed, using local fallback: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return this.localIncrement(key, ttl, limit, blockDuration);
    }
  }

  private localIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const current = this.local.get(key);
    if (!current || current.expiresAt <= now) {
      this.local.set(key, { totalHits: 1, expiresAt: now + ttl });
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
    current.totalHits += 1;
    const isBlocked = current.totalHits > limit;
    return {
      totalHits: current.totalHits,
      timeToExpire: Math.max(0, current.expiresAt - now),
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }
}
