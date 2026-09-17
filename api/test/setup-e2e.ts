process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';

// Prefer DATABASE_URL / REDIS_URL already exported (CI, docker-compose, local).
// Do not hardcode host ports: compose uses POSTGRES_PORT / REDIS_PORT.
// Defaults match api/.env.example (POSTGRES_PORT=5432, REDIS_PORT=6379).
const postgresUser = process.env.POSTGRES_USER ?? 'furkansogutma';
const postgresPassword = process.env.POSTGRES_PASSWORD ?? 'changeme-local-only';
const postgresHost = process.env.POSTGRES_HOST ?? 'localhost';
const postgresPort = process.env.POSTGRES_PORT ?? '5432';
const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = process.env.REDIS_PORT ?? '6379';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/furkansogutma_test`;
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters!';
process.env.ACCESS_TOKEN_EXPIRES_IN =
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN =
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
process.env.REDIS_URL =
  process.env.REDIS_URL ?? `redis://${redisHost}:${redisPort}`;
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ??
  'http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002';
