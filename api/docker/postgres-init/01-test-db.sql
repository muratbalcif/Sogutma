-- Created only on first volume init. E2E uses furkansogutma_test on the same
-- Postgres instance as local docker-compose (host port from POSTGRES_PORT).
SELECT 'CREATE DATABASE furkansogutma_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'furkansogutma_test')\gexec
