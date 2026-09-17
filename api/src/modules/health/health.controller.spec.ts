import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };
  const redis = {
    status: 'ready',
    connect: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok for basic health', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('returns ok for liveness', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('ready succeeds when database is up', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('ready fails when database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
