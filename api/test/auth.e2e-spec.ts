import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus, UserType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/modules/prisma/prisma.service';

interface AuthResponseBody {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    userType: UserType;
    status: UserStatus;
  };
  accessToken: string;
  refreshToken: string;
}

interface ErrorResponseBody {
  message: string | string[];
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const password = 'Password123!';
  const email = `auth.e2e.${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { contains: 'auth.e2e.' } },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);

      if (userIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } },
        });
        const adminUsers = await prisma.adminUser.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const adminUserIds = adminUsers.map((adminUser) => adminUser.id);
        if (adminUserIds.length > 0) {
          await prisma.adminUserRole.deleteMany({
            where: { adminUserId: { in: adminUserIds } },
          });
          await prisma.adminUser.deleteMany({
            where: { id: { in: adminUserIds } },
          });
        }
        await prisma.corporateCustomer.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('registers, logs in, uses me/refresh/logout with token rotation', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Murat',
        lastName: 'Balci',
        phone: '+905551112233',
        userType: UserType.INDIVIDUAL,
      })
      .expect(201);

    const registerBody = registerResponse.body as AuthResponseBody;

    expect(registerBody.user.email).toBe(email);
    expect(registerBody.accessToken).toBeDefined();
    expect(registerBody.refreshToken).toBeDefined();
    expect(registerBody).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(registerBody)).not.toContain('passwordHash');

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(storedUser.passwordHash).not.toEqual(password);
    expect(storedUser.passwordHash.startsWith('$argon2')).toBe(true);

    const storedRefresh = await prisma.refreshToken.findFirstOrThrow({
      where: { userId: storedUser.id },
    });
    expect(storedRefresh.tokenHash).not.toEqual(registerBody.refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Murat',
        lastName: 'Balci',
        userType: UserType.INDIVIDUAL,
      })
      .expect(409);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const loginBody = loginResponse.body as AuthResponseBody;
    const accessToken = loginBody.accessToken;
    const refreshToken = loginBody.refreshToken;

    const invalidLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);

    expect((invalidLogin.body as ErrorResponseBody).message).toBe(
      'Invalid email or password',
    );

    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      email,
      firstName: 'Murat',
      lastName: 'Balci',
      userType: UserType.INDIVIDUAL,
      status: UserStatus.ACTIVE,
    });
    expect(meResponse.body).not.toHaveProperty('passwordHash');

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const refreshBody = refreshResponse.body as AuthResponseBody;
    const rotatedRefreshToken = refreshBody.refreshToken;
    expect(rotatedRefreshToken).toBeDefined();
    expect(rotatedRefreshToken).not.toEqual(refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(200)
      .expect({ success: true });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(200);
  });

  it('rejects login for blocked users', async () => {
    const blockedEmail = `auth.e2e.blocked.${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: blockedEmail,
        password,
        firstName: 'Blocked',
        lastName: 'User',
        userType: UserType.INDIVIDUAL,
      })
      .expect(201);

    await prisma.user.update({
      where: { email: blockedEmail },
      data: { status: UserStatus.BLOCKED },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: blockedEmail, password })
      .expect(401);
  });

  it('rejects expired refresh tokens', async () => {
    const expiredEmail = `auth.e2e.expired.${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: expiredEmail,
        password,
        firstName: 'Expired',
        lastName: 'Token',
        userType: UserType.INDIVIDUAL,
      })
      .expect(201);

    const registerBody = registerResponse.body as AuthResponseBody;
    const refreshToken = registerBody.refreshToken;
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: expiredEmail },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
