import Redis from 'ioredis';

/** Flush test Redis between suites so throttles do not leak across e2e files. */
export async function flushTestRedis(): Promise<void> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 500,
    enableOfflineQueue: false,
  });
  try {
    await client.connect();
    await client.flushdb();
  } catch {
    // Redis optional for suites that do not assert rate limits
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
