import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus, UserType } from '@prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { UsersService } from '../users/users.service';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password/password.service';
import { JwtPayload, TokenService } from './token/token.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { AdminService } from '../admin/admin.service';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly adminService: AdminService,
    private readonly customersService: CustomersService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      userType: dto.userType,
    });

    if (
      dto.userType === UserType.CORPORATE &&
      dto.companyName &&
      dto.taxNumber &&
      dto.taxOffice
    ) {
      await this.customersService.createCorporateProfile({
        userId: user.id,
        companyName: dto.companyName,
        taxNumber: dto.taxNumber,
        taxOffice: dto.taxOffice,
        identityNumber: dto.identityNumber,
      });
    }

    const tokens = await this.tokenService.issueTokenPair(user);
    const access = await this.adminService.getAccessForUser(user.id);

    return {
      user: this.usersService.toResponse(user, access),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthTokensResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (
      user.status === UserStatus.INACTIVE ||
      user.status === UserStatus.BLOCKED
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.tokenService.issueTokenPair(user);
    const access = await this.adminService.getAccessForUser(user.id);

    return {
      user: this.usersService.toResponse(user, access),
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponseDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const anyStored =
      await this.tokenService.findRefreshTokenByRaw(refreshToken);

    if (!anyStored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse of a rotated/revoked refresh token → revoke all sessions for user.
    if (anyStored.revokedAt) {
      await this.tokenService.revokeAllRefreshTokensForUser(anyStored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (anyStored.expiresAt.getTime() <= Date.now()) {
      await this.tokenService.revokeRefreshToken(refreshToken);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (anyStored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.tokenService.revokeRefreshToken(refreshToken);
    const tokens = await this.tokenService.issueTokenPair(user);
    const access = await this.adminService.getAccessForUser(user.id);

    return {
      user: this.usersService.toResponse(user, access),
      ...tokens,
    };
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokenService.revokeRefreshToken(refreshToken);
    return { success: true };
  }

  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdOrThrow(userId);
    const access = await this.adminService.getAccessForUser(user.id);
    return this.usersService.toResponse(user, access);
  }

  async buildAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Unauthorized');
    }

    const access = await this.adminService.getAccessForUser(user.id);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType,
      status: user.status,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Accepts the request without revealing whether the email exists.
   * Mail/token delivery is not wired yet — do not claim an email was sent.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    await this.usersService.findByEmail(email);
    return {
      message:
        'Şifre sıfırlama talebiniz alındı. E-posta gönderimi henüz yapılandırılmadığı için bağlantı gönderilemedi; destek ile iletişime geçin.',
    };
  }
}
