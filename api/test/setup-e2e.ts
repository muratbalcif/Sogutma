import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';

/**
 * Load api/.env without overriding already-exported variables (CI / shell).
 * Do not treat .env DATABASE_URL as the e2e target — that points at the app DB.
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function composePublishedPort(
  service: string,
  containerPort: string,
): string | undefined {
  try {
    const out = execSync(`docker compose port ${service} ${containerPort}`, {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const port = out.split(':').pop();
    return port && /^\d+$/.test(port) ? port : undefined;
  } catch {
    return undefined;
  }
}

const exportedDatabaseUrl = process.env.DATABASE_URL;
const exportedRedisUrl = process.env.REDIS_URL;
const exportedPostgresPort = process.env.POSTGRES_PORT;
const exportedRedisPort = process.env.REDIS_PORT;

loadEnvFile(resolve(__dirname, '../.env'));

const postgresUser = process.env.POSTGRES_USER ?? 'furkansogutma';
const postgresPassword = process.env.POSTGRES_PASSWORD ?? 'changeme-local-only';
const postgresHost = process.env.POSTGRES_HOST ?? 'localhost';
const redisHost = process.env.REDIS_HOST ?? 'localhost';

// Prefer CI/shell DATABASE_URL. Otherwise use compose published host port
// (not hardcoded) then POSTGRES_PORT from env/.env, then 5432.
const postgresPort =
  exportedPostgresPort ??
  (exportedDatabaseUrl
    ? undefined
    : composePublishedPort('postgres', '5432')) ??
  process.env.POSTGRES_PORT ??
  '5432';
const redisPort =
  exportedRedisPort ??
  (exportedRedisUrl ? undefined : composePublishedPort('redis', '6379')) ??
  process.env.REDIS_PORT ??
  '6379';

if (!exportedDatabaseUrl) {
  process.env.DATABASE_URL = `postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/furkansogutma_test`;
}
if (!exportedRedisUrl) {
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;
}

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-characters!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-characters!';
process.env.ACCESS_TOKEN_EXPIRES_IN =
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN =
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ??
  'http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002';
