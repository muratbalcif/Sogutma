import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { EnvironmentVariables } from '../../../config/env.validation';
import { parseDurationToMs } from '../../../common/utils/duration.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  userType: UserType;
  jti?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueTokenPair(user: {
    id: string;
    email: string;
    userType: UserType;
  }): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.configService.get('ACCESS_TOKEN_EXPIRES_IN', {
        infer: true,
      }),
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        jti: randomBytes(16).toString('hex'),
      },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN', {
          infer: true,
        }),
      },
    );

    const refreshExpiresIn = this.configService.get(
      'REFRESH_TOKEN_EXPIRES_IN',
      {
        infer: true,
      },
    );
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async findRefreshTokenByRaw(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveRefreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
    });
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.revokeRefreshTokenByHash(this.hashToken(rawToken));
  }

  /** Reuse detection: revoke every refresh token for the user. */
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
