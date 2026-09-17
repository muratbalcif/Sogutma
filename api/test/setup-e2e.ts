process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';
// Prefer DATABASE_URL / REDIS_URL from environment (CI, docker-compose, local).
// Defaults match api/.env.example + docker-compose.yml (not a hardcoded CI-only port).
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://furkansogutma:changeme-local-only@localhost:5432/furkansogutma_test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters!';
process.env.ACCESS_TOKEN_EXPIRES_IN =
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN =
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002';
